# server/ml_api.py
"""
ML model loading, prediction, and retraining endpoints.
"""
import os, json, threading, time
from datetime import datetime
import numpy as np
import pandas as pd

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR   = os.path.join(BASE, "cloud-threat-detection", "models")
FEATURES_DIR = os.path.join(BASE, "cloud-threat-detection", "data", "features")
REPORT_PATH  = os.path.join(MODELS_DIR, "metrics_report.json")
RF_PATH      = os.path.join(MODELS_DIR, "rf_baseline.pkl")
DT_PATH      = os.path.join(MODELS_DIR, "dt_baseline.pkl")

_model = None       # RandomForest
_dt_model = None    # DecisionTree
_model_lock = threading.Lock()
_retrain_status = {"running": False, "progress": "", "error": ""}


def load_model():
    global _model, _dt_model
    ok = True
    try:
        import joblib
        with _model_lock:
            _model = joblib.load(RF_PATH)
        print(f"[ML] RandomForest loaded from {RF_PATH}")
    except Exception as e:
        print(f"[ML] Warning: could not load RF model — {e}")
        ok = False
    try:
        import joblib
        if os.path.exists(DT_PATH):
            with _model_lock:
                _dt_model = joblib.load(DT_PATH)
            print(f"[ML] DecisionTree loaded from {DT_PATH}")
        else:
            print(f"[ML] DecisionTree not found at {DT_PATH} — run pipeline first")
    except Exception as e:
        print(f"[ML] Warning: could not load DT model — {e}")
    return ok


def get_model_info():
    """Return model metadata from metrics_report.json."""
    try:
        with open(REPORT_PATH) as f:
            data = json.load(f)
        data["rf_model_exists"] = os.path.exists(RF_PATH)
        data["dt_model_exists"] = os.path.exists(DT_PATH)
        data["last_modified"] = (
            datetime.fromtimestamp(os.path.getmtime(RF_PATH)).isoformat()
            if os.path.exists(RF_PATH) else None
        )
        return data
    except Exception as e:
        return {"error": str(e), "rf_model_exists": os.path.exists(RF_PATH),
                "dt_model_exists": os.path.exists(DT_PATH)}


def predict(features_dict: dict, model_type: str = "rf") -> dict:
    """Run prediction — model_type: 'rf' (RandomForest) or 'dt' (DecisionTree)."""
    global _model, _dt_model
    if _model is None and _dt_model is None:
        if not load_model():
            return {"error": "No models loaded. Run python run_pipeline.py first."}

    chosen = _dt_model if model_type == "dt" else _model
    model_name = "DecisionTree" if model_type == "dt" else "RandomForest"

    if chosen is None:
        return {"error": f"{model_name} model not available. Run pipeline first."}
    try:
        feature_names = chosen.feature_names_in_
        row = pd.DataFrame([features_dict]).reindex(columns=feature_names).fillna(0)
        row = row.replace([np.inf, -np.inf], 0)
        with _model_lock:
            pred = int(chosen.predict(row)[0])
            prob = float(chosen.predict_proba(row)[0][pred])
        return {
            "label": pred,
            "label_str": "ATTACK" if pred == 1 else "BENIGN",
            "confidence": round(prob * 100, 2),
            "model": model_name,
        }
    except Exception as e:
        return {"error": str(e)}


def retrain_model_async(db_conn_fn, callback=None):
    """
    Run retraining in background thread.
    Uses the existing pipeline scripts with raw 79-column features.
    """
    global _retrain_status

    if _retrain_status["running"]:
        return {"status": "already_running"}

    def _run():
        global _model
        _retrain_status["running"] = True
        _retrain_status["error"] = ""
        try:
            import subprocess, sys
            retrain_script = os.path.join(BASE, "run_pipeline.py")
            _retrain_status["progress"] = "Running ML pipeline..."
            result = subprocess.run(
                [sys.executable, retrain_script],
                capture_output=True, text=True, timeout=600, cwd=BASE
            )
            if result.returncode != 0:
                _retrain_status["error"] = result.stderr[-500:]
                _retrain_status["progress"] = "Failed"
            else:
                _retrain_status["progress"] = "Complete — reloading model..."
                load_model()

                # Parse new metrics from report
                info = get_model_info()
                now = datetime.now().isoformat(timespec="seconds")
                try:
                    conn = db_conn_fn()
                    rf = info.get("random_forest", {})
                    conn.execute(
                        """INSERT INTO ml_model_info
                           (trained_at,accuracy,precision_score,recall_score,f1_score,
                            dataset,train_samples,test_samples,features)
                           VALUES (?,?,?,?,?,?,?,?,?)""",
                        (now, rf.get("accuracy"), rf.get("precision"),
                         rf.get("recall"), rf.get("f1_score"),
                         info.get("dataset"), info.get("train_samples"),
                         info.get("test_samples"), info.get("features"))
                    )
                    conn.commit()
                    conn.close()
                except Exception as db_err:
                    print(f"[ML] DB update error: {db_err}")

                _retrain_status["progress"] = "Done"
                if callback:
                    callback(info)

        except subprocess.TimeoutExpired:
            _retrain_status["error"] = "Retraining timed out (>10 min)"
            _retrain_status["progress"] = "Timeout"
        except Exception as e:
            _retrain_status["error"] = str(e)
            _retrain_status["progress"] = "Error"
        finally:
            _retrain_status["running"] = False

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"status": "started"}


def get_retrain_status():
    return dict(_retrain_status)
