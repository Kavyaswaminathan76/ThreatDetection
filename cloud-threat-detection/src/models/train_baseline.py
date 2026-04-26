# src/models/train_baseline.py
import os
import argparse
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.metrics import classification_report, confusion_matrix
import joblib
import time

def supervised_train(train_csv, test_csv, out_dir):
    train = pd.read_csv(train_csv)
    test = pd.read_csv(test_csv)
    X_train = train.drop(columns=['entity_label'])
    y_train = train['entity_label']
    X_test = test.drop(columns=['entity_label'])
    y_test = test['entity_label']

    clf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    t0 = time.time()
    clf.fit(X_train, y_train)
    t1 = time.time()
    preds = clf.predict(X_test)
    print("Training time (s):", round(t1-t0,2))
    print("Classification report:")
    print(classification_report(y_test, preds))
    print("Confusion matrix:\n", confusion_matrix(y_test, preds))

    os.makedirs(out_dir, exist_ok=True)
    joblib.dump(clf, os.path.join(out_dir, 'rf_baseline.pkl'))
    print("Saved RandomForest model to", os.path.join(out_dir, 'rf_baseline.pkl'))

    # save feature importances
    fi = pd.DataFrame({'feature': X_train.columns, 'importance': clf.feature_importances_}).sort_values('importance', ascending=False)
    fi.to_csv(os.path.join(out_dir, 'feature_importances.csv'), index=False)
    print("Saved feature importances.")

def unsupervised_train(train_csv, test_csv, out_dir):
    X_train = pd.read_csv(train_csv)
    X_test = pd.read_csv(test_csv)
    clf = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
    clf.fit(X_train)
    scores = -clf.decision_function(X_test)  # higher -> more anomalous
    out = X_test.copy()
    out['anomaly_score'] = scores
    os.makedirs(out_dir, exist_ok=True)
    out.to_csv(os.path.join(out_dir, 'unsup_scores.csv'), index=False)
    joblib.dump(clf, os.path.join(out_dir, 'iso_baseline.pkl'))
    print("Saved IsolationForest to", os.path.join(out_dir, 'iso_baseline.pkl'))
    print("Saved anomaly scores to", os.path.join(out_dir, 'unsup_scores.csv'))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--features-dir", default="data/features")
    parser.add_argument("--out", default="models")
    args = parser.parse_args()

    train_csv = os.path.join(args.features_dir, 'train.csv')
    test_csv = os.path.join(args.features_dir, 'test.csv')
    if os.path.exists(train_csv) and os.path.exists(test_csv):
        print("Supervised training path")
        supervised_train(train_csv, test_csv, args.out)
    else:
        print("Unsupervised training path")
        train_u = os.path.join(args.features_dir, 'train_unsup.csv')
        test_u = os.path.join(args.features_dir, 'test_unsup.csv')
        if os.path.exists(train_u) and os.path.exists(test_u):
            unsupervised_train(train_u, test_u, args.out)
        else:
            raise SystemExit("No train/test files found in features dir. Run build_features first.")
