# src/serve/alert_cli.py
import argparse
import os
import joblib
import pandas as pd
import numpy as np

def show_supervised_alerts(model_path, test_csv, top_n=20):
    clf = joblib.load(model_path)
    test = pd.read_csv(test_csv)
    X = test.drop(columns=['entity_label']) if 'entity_label' in test.columns else test
    preds = clf.predict(X)
    probs = clf.predict_proba(X)[:,1] if hasattr(clf, "predict_proba") else None
    test = test.copy()
    test['pred'] = preds
    if probs is not None:
        test['score'] = probs
        alerts = test[test['pred']==1].sort_values('score', ascending=False).head(top_n)
    else:
        alerts = test[test['pred']==1].head(top_n)
    print(f"Top {len(alerts)} predicted attack entities:")
    for i, row in alerts.iterrows():
        eid = row.name
        score = row['score'] if 'score' in row else 'N/A'
        print("Entity:", eid, "score:", score)
        # show top 5 features (global importance)
    # print global top features
    try:
        fi = pd.read_csv(os.path.join(os.path.dirname(model_path), 'feature_importances.csv'))
        print("\nTop features (global importance):")
        print(fi.head(10).to_string(index=False))
    except:
        pass

def show_unsup_alerts(model_path, scores_csv, top_n=20):
    df = pd.read_csv(scores_csv)
    alerts = df.sort_values('anomaly_score', ascending=False).head(top_n)
    print(f"Top {len(alerts)} unsupervised anomaly entities:")
    for _, row in alerts.iterrows():
        print("Anomaly score:", row['anomaly_score'], " | features:", row.drop('anomaly_score').to_dict())

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--models-dir", default="models")
    parser.add_argument("--features-dir", default="data/features")
    parser.add_argument("--top", type=int, default=20)
    args = parser.parse_args()

    rf_model = os.path.join(args.models_dir, 'rf_baseline.pkl')
    iso_model = os.path.join(args.models_dir, 'iso_baseline.pkl')
    if os.path.exists(rf_model):
        test_csv = os.path.join(args.features_dir, 'test.csv')
        show_supervised_alerts(rf_model, test_csv, top_n=args.top)
    elif os.path.exists(iso_model):
        scores_csv = os.path.join(args.features_dir, 'unsup_scores.csv')
        show_unsup_alerts(iso_model, scores_csv, top_n=args.top)
    else:
        print("No models found in", args.models_dir, " - run training first.")
