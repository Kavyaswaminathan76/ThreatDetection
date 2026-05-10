"""
T-RBAC ML Pipeline — Full Feature Version
Trains Random Forest + Decision Tree (per paper abstract) + IsolationForest
on raw CICIDS2017 flow features.

Run: python run_pipeline.py
"""
import os, sys, time, json
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, confusion_matrix,
    accuracy_score, precision_score, recall_score, f1_score
)
import joblib

BASE        = os.path.dirname(os.path.abspath(__file__))
RAW_DIR     = os.path.join(BASE, "cloud-threat-detection", "data", "raw")
MODELS_DIR  = os.path.join(BASE, "cloud-threat-detection", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# ── STEP 1: Load raw CSV files ──────────────────────────────────
print("=" * 60)
print("STEP 1 — Loading raw CICIDS2017 CSVs")
print("=" * 60)

csv_files = [f for f in os.listdir(RAW_DIR) if f.endswith('.csv')]
if not csv_files:
    sys.exit("ERROR: No CSV files in data/raw/. Download the dataset first.")

dfs = []
for fname in csv_files:
    path = os.path.join(RAW_DIR, fname)
    df = pd.read_csv(path, low_memory=False)
    print(f"  Loaded {fname} → {df.shape}")
    dfs.append(df)

df = pd.concat(dfs, ignore_index=True)
print(f"\nCombined shape: {df.shape}")

# ── STEP 2: Normalize label column ─────────────────────────────
print("\n" + "=" * 60)
print("STEP 2 — Normalizing Labels")
print("=" * 60)

# Strip whitespace from all column names
df.columns = df.columns.str.strip()

# Find label column
label_col = None
for candidate in ['Label', 'label', ' Label']:
    if candidate.strip() in df.columns:
        label_col = candidate.strip()
        break

if label_col is None:
    sys.exit(f"ERROR: No label column. Columns: {list(df.columns)}")

print(f"Label column: '{label_col}'")
print("Raw label distribution:")
print(df[label_col].value_counts())

# Binary: BENIGN=0, everything else=1
df['target'] = (df[label_col].str.strip().str.upper() != 'BENIGN').astype(int)
df = df.drop(columns=[label_col])
print(f"\nBinary label: 0=BENIGN, 1=ATTACK")
print(df['target'].value_counts())

# ── STEP 3: Feature Engineering ────────────────────────────────
print("\n" + "=" * 60)
print("STEP 3 — Feature Engineering (79 raw flow features)")
print("=" * 60)

# Keep only numeric columns (excluding target)
numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
if 'target' in numeric_cols:
    numeric_cols.remove('target')

X = df[numeric_cols].copy()
y = df['target'].copy()

print(f"Numeric features available: {len(numeric_cols)}")
print(f"Feature names: {numeric_cols[:10]}... (showing first 10)")

# Clean: replace inf, clip extreme values, fill NaN
X = X.replace([np.inf, -np.inf], np.nan)
X = X.fillna(0)

# Clip at 99.9th percentile per column to handle outliers
print("Clipping extreme values (99.9th percentile)...")
for col in X.columns:
    cap = X[col].quantile(0.999)
    if cap > 0:
        X[col] = X[col].clip(upper=cap)

# Drop zero-variance columns
var = X.var()
zero_var_cols = var[var == 0].index.tolist()
if zero_var_cols:
    print(f"Dropping {len(zero_var_cols)} zero-variance columns: {zero_var_cols}")
    X = X.drop(columns=zero_var_cols)

print(f"Final feature count: {X.shape[1]}")
print(f"Inf check: {X.isin([np.inf, -np.inf]).any().any()} (should be False)")
print(f"NaN check: {X.isna().any().any()} (should be False)")

# ── STEP 4: Train/Test Split ────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 4 — Train/Test Split (80/20)")
print("=" * 60)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y)
print(f"Train: {X_train.shape}  |  Test: {X_test.shape}")

# ── STEP 5: RandomForest Training ──────────────────────────────
print("\n" + "=" * 60)
print("STEP 5 — Training RandomForest (100 trees, full features)")
print("=" * 60)

clf = RandomForestClassifier(
    n_estimators=100, random_state=42, n_jobs=-1,
    max_depth=None, min_samples_leaf=1)

t0 = time.time()
clf.fit(X_train, y_train)
t1 = time.time()
train_time = round(t1 - t0, 2)
print(f"Training time: {train_time}s")

preds = clf.predict(X_test)

acc  = round(accuracy_score(y_test, preds) * 100, 2)
prec = round(precision_score(y_test, preds, average="weighted", zero_division=0) * 100, 2)
rec  = round(recall_score(y_test, preds, average="weighted", zero_division=0) * 100, 2)
f1   = round(f1_score(y_test, preds, average="weighted", zero_division=0) * 100, 2)
cm   = confusion_matrix(y_test, preds).tolist()

print(f"\n  Accuracy  : {acc}%")
print(f"  Precision : {prec}%")
print(f"  Recall    : {rec}%")
print(f"  F1-Score  : {f1}%")
print(f"\nFull Classification Report:")
print(classification_report(y_test, preds, zero_division=0))
print(f"Confusion Matrix:\n{confusion_matrix(y_test, preds)}")

# Save model
rf_path = os.path.join(MODELS_DIR, "rf_baseline.pkl")
joblib.dump(clf, rf_path)
print(f"\nSaved RandomForest → {rf_path}")

# Feature importances
fi = pd.DataFrame({
    'feature': X_train.columns,
    'importance': clf.feature_importances_
}).sort_values('importance', ascending=False)
fi_path = os.path.join(MODELS_DIR, "feature_importances.csv")
fi.to_csv(fi_path, index=False)
print(f"Saved feature importances → {fi_path}")
print("\nTop 15 features:")
print(fi.head(15).to_string(index=False))

# ── STEP 6: Decision Tree (required by paper abstract) ─────────
print("\n" + "=" * 60)
print("STEP 6 — Training Decision Tree Classifier")
print("=" * 60)

dt = DecisionTreeClassifier(random_state=42, max_depth=20, min_samples_leaf=1)
t0_dt = time.time()
dt.fit(X_train, y_train)
dt_train_time = round(time.time() - t0_dt, 2)
print(f"Training time: {dt_train_time}s")

dt_preds = dt.predict(X_test)
dt_acc  = round(accuracy_score(y_test, dt_preds) * 100, 2)
dt_prec = round(precision_score(y_test, dt_preds, average="weighted", zero_division=0) * 100, 2)
dt_rec  = round(recall_score(y_test, dt_preds, average="weighted", zero_division=0) * 100, 2)
dt_f1   = round(f1_score(y_test, dt_preds, average="weighted", zero_division=0) * 100, 2)
dt_cm   = confusion_matrix(y_test, dt_preds).tolist()

print(f"\n  Accuracy  : {dt_acc}%")
print(f"  Precision : {dt_prec}%")
print(f"  Recall    : {dt_rec}%")
print(f"  F1-Score  : {dt_f1}%")
print(classification_report(y_test, dt_preds, zero_division=0))

dt_path = os.path.join(MODELS_DIR, "dt_baseline.pkl")
joblib.dump(dt, dt_path)
print(f"Saved DecisionTree → {dt_path}")

# ── STEP 7: IsolationForest ─────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 7 — Training IsolationForest (Anomaly Detection)")
print("=" * 60)

iso = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
iso.fit(X_train)
iso_preds = iso.predict(X_test)          # -1=anomaly, 1=normal
iso_binary = (iso_preds == -1).astype(int)
iso_path = os.path.join(MODELS_DIR, "iso_baseline.pkl")
joblib.dump(iso, iso_path)
print(f"Saved IsolationForest → {iso_path}")
print(f"Anomalies detected: {iso_binary.sum()} / {len(iso_binary)} ({iso_binary.mean()*100:.2f}%)")

# ── STEP 8: Save metrics report ────────────────────────────────
print("\n" + "=" * 60)
print("STEP 8 — Saving Metrics Report")
print("=" * 60)

metrics = {
    "dataset": "CICIDS2017 (Friday DDoS + PortScan) — raw flow features",
    "train_samples": int(len(X_train)),
    "test_samples": int(len(X_test)),
    "features": int(X.shape[1]),
    "feature_names": list(X_train.columns),
    "training_time_s": train_time,
    "random_forest": {
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1_score": f1,
        "confusion_matrix": cm,
        "training_time_s": train_time
    },
    "decision_tree": {
        "accuracy": dt_acc,
        "precision": dt_prec,
        "recall": dt_rec,
        "f1_score": dt_f1,
        "confusion_matrix": dt_cm,
        "training_time_s": dt_train_time
    },
    "isolation_forest": {
        "anomalies_detected": int(iso_binary.sum()),
        "total_tested": int(len(iso_binary)),
        "anomaly_rate_pct": round(float(iso_binary.mean()) * 100, 2)
    },
    "top_features": fi.head(15)[['feature', 'importance']].assign(
        importance=lambda d: d['importance'].round(6)
    ).to_dict(orient='records')
}

report_path = os.path.join(MODELS_DIR, "metrics_report.json")
with open(report_path, "w") as f:
    json.dump(metrics, f, indent=2)

print(f"Metrics saved → {report_path}")
print("\n" + "=" * 60)
print("ALL DONE")
print("=" * 60)
print(f"  RandomForest : Acc={acc}%    F1={f1}%")
print(f"  DecisionTree : Acc={dt_acc}% F1={dt_f1}%")
print(f"  IsoForest    : {iso_binary.sum()} anomalies / {len(iso_binary)} samples")
print(f"  Features     : {X.shape[1]}")
print("=" * 60)
