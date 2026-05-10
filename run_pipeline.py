"""
Full ML pipeline runner:
1. Checks train/test CSVs for required columns
2. Trains RandomForest (supervised) model
3. Trains IsolationForest (unsupervised) model  
4. Saves models, metrics, and feature importances
5. Generates a clean metrics report
"""
import os, sys, time, json
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.metrics import (
    classification_report, confusion_matrix,
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
)
import joblib

BASE = os.path.dirname(os.path.abspath(__file__))
FEATURES_DIR = os.path.join(BASE, "cloud-threat-detection", "data", "features")
MODELS_DIR   = os.path.join(BASE, "cloud-threat-detection", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

train_csv = os.path.join(FEATURES_DIR, "train.csv")
test_csv  = os.path.join(FEATURES_DIR, "test.csv")

print("=" * 60)
print("STEP 1 — Loading train/test splits")
print("=" * 60)

train = pd.read_csv(train_csv)
test  = pd.read_csv(test_csv)
print(f"Train shape: {train.shape}")
print(f"Test shape:  {test.shape}")
print(f"Columns: {list(train.columns)}")

# ------------------------------------------------------------------
# Detect label column
# ------------------------------------------------------------------
label_col = None
for candidate in ["entity_label", "Label", "label", " Label"]:
    if candidate in train.columns:
        label_col = candidate
        break

if label_col is None:
    print("ERROR: No label column found. Columns are:", list(train.columns))
    sys.exit(1)

print(f"\nDetected label column: '{label_col}'")
print("Label distribution (train):")
print(train[label_col].value_counts())

X_train = train.drop(columns=[label_col])
y_train = train[label_col]
X_test  = test.drop(columns=[label_col])
y_test  = test[label_col]

# Drop any remaining non-numeric columns
X_train = X_train.select_dtypes(include=[np.number])
X_test  = X_test[X_train.columns]

# Replace inf/-inf with NaN, then fill NaN with 0
X_train = X_train.replace([np.inf, -np.inf], np.nan).fillna(0)
X_test  = X_test.replace([np.inf, -np.inf], np.nan).fillna(0)

# Clip extreme values to prevent float32 overflow (clip at 99.9th percentile)
for col in X_train.columns:
    cap = X_train[col].quantile(0.999)
    if cap > 0:
        X_train[col] = X_train[col].clip(upper=cap)
        X_test[col]  = X_test[col].clip(upper=cap)

print(f"\nFeature count: {X_train.shape[1]}")
print(f"Inf/NaN check after cleaning: {X_train.isin([np.inf, -np.inf]).any().any()} (should be False)")

# ------------------------------------------------------------------
# SUPERVISED — Random Forest
# ------------------------------------------------------------------
print("\n" + "=" * 60)
print("STEP 2 — Training RandomForest Classifier")
print("=" * 60)

clf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1, max_depth=20)
t0 = time.time()
clf.fit(X_train, y_train)
t1 = time.time()
train_time = round(t1 - t0, 2)
print(f"Training time: {train_time}s")

preds = clf.predict(X_test)
proba = clf.predict_proba(X_test)

acc  = round(accuracy_score(y_test, preds) * 100, 2)
prec = round(precision_score(y_test, preds, average="weighted", zero_division=0) * 100, 2)
rec  = round(recall_score(y_test, preds, average="weighted", zero_division=0) * 100, 2)
f1   = round(f1_score(y_test, preds, average="weighted", zero_division=0) * 100, 2)

print(f"\nAccuracy  : {acc}%")
print(f"Precision : {prec}%")
print(f"Recall    : {rec}%")
print(f"F1-Score  : {f1}%")
print("\nFull Classification Report:")
print(classification_report(y_test, preds, zero_division=0))
print("Confusion Matrix:")
print(confusion_matrix(y_test, preds))

# Save model
rf_path = os.path.join(MODELS_DIR, "rf_baseline.pkl")
joblib.dump(clf, rf_path)
print(f"\nSaved RandomForest model → {rf_path}")

# Save feature importances
fi = pd.DataFrame({
    "feature": X_train.columns,
    "importance": clf.feature_importances_
}).sort_values("importance", ascending=False)
fi_path = os.path.join(MODELS_DIR, "feature_importances.csv")
fi.to_csv(fi_path, index=False)
print(f"Saved feature importances → {fi_path}")
print("\nTop 10 features:")
print(fi.head(10).to_string(index=False))

# ------------------------------------------------------------------
# UNSUPERVISED — Isolation Forest
# ------------------------------------------------------------------
print("\n" + "=" * 60)
print("STEP 3 — Training IsolationForest (Anomaly Detection)")
print("=" * 60)

iso = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
iso.fit(X_train)
scores = -iso.decision_function(X_test)
iso_preds = iso.predict(X_test)          # -1 = anomaly, 1 = normal
iso_binary = (iso_preds == -1).astype(int)

iso_path = os.path.join(MODELS_DIR, "iso_baseline.pkl")
joblib.dump(iso, iso_path)
print(f"Saved IsolationForest → {iso_path}")
print(f"Anomalies detected: {iso_binary.sum()} / {len(iso_binary)} test samples")

# ------------------------------------------------------------------
# Save metrics report JSON
# ------------------------------------------------------------------
metrics = {
    "dataset": "CICIDS2017 (Friday DDoS + PortScan)",
    "train_samples": int(len(X_train)),
    "test_samples": int(len(X_test)),
    "features": int(X_train.shape[1]),
    "training_time_s": train_time,
    "random_forest": {
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1_score": f1
    },
    "isolation_forest": {
        "anomalies_detected": int(iso_binary.sum()),
        "anomaly_rate_pct": round(iso_binary.mean() * 100, 2)
    },
    "top_features": fi["feature"].head(10).tolist()
}

report_path = os.path.join(MODELS_DIR, "metrics_report.json")
with open(report_path, "w") as f:
    json.dump(metrics, f, indent=2)

print("\n" + "=" * 60)
print("ALL DONE — Final Metrics Summary")
print("=" * 60)
print(json.dumps(metrics, indent=2))
print(f"\nMetrics report saved → {report_path}")
