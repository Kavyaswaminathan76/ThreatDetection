# src/features/build_features.py
import os
import argparse
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split

SRC_CANDIDATES = ['Source IP', 'SourceIP', 'src_ip', 'srcip', 'SrcAddr', 'srcaddr', 'Source', 'source']
DST_CANDIDATES = ['Destination IP', 'DestinationIP', 'dst_ip', 'dstip', 'DstAddr', 'dstaddr', 'Destination', 'destination']
BYTES_CANDIDATES = ['Bytes', 'bytes', 'Total Length', 'Flow Bytes/s', 'TotLen', 'Total Fwd Packets', 'Total Length of Fwd Packets']

def find_column(df, candidates):
    for c in candidates:
        if c in df.columns:
            return c
    # fallback: try contains
    for c in df.columns:
        low = c.lower()
        for cand in candidates:
            if cand.split()[0].lower() in low:
                return c
    return None

def entropy_from_counts(counts):
    p = counts / counts.sum()
    p = p[p > 0]
    return -(p * np.log2(p)).sum() if len(p)>0 else 0.0

def main(clean_path, out_dir):
    df = pd.read_csv(clean_path, low_memory=False)
    print("Loaded cleaned:", df.shape)
    src_col = find_column(df, SRC_CANDIDATES)
    dst_col = find_column(df, DST_CANDIDATES)
    bytes_col = find_column(df, BYTES_CANDIDATES)

    print("Detected columns -> src:", src_col, " dst:", dst_col, " bytes:", bytes_col)

    # If no src_col, use index as entity (entity per row)
    if src_col is None:
        df['_entity'] = df.index.astype(str)
    else:
        df['_entity'] = df[src_col].astype(str)

    # choose a label if exists
    label_exists = 'Label' in df.columns
    if label_exists:
        df['Label'] = df['Label'].fillna(-1).astype(int)

    # convert bytes to numeric if exists
    if bytes_col and bytes_col in df.columns:
        df['_bytes'] = pd.to_numeric(df[bytes_col], errors='coerce').fillna(0).astype(float)
    else:
        df['_bytes'] = 0.0

    # port column detection
    port_cols = [c for c in df.columns if 'port' in c.lower()]
    port_col = port_cols[0] if port_cols else None

    # protocol column detection
    proto_cols = [c for c in df.columns if 'proto' in c.lower() or 'protocol' in c.lower()]
    proto_col = proto_cols[0] if proto_cols else None

    # compute per-entity aggregates
    agg = df.groupby('_entity').agg(
        total_flows = ('_entity','count'),
        total_bytes = ('_bytes','sum'),
        mean_bytes = ('_bytes','mean'),
    ).reset_index()

    # unique dests and unique ports
    if dst_col:
        dst_counts = df.groupby('_entity')[dst_col].nunique().reset_index().rename(columns={dst_col:'unique_dst_ips'})
        agg = agg.merge(dst_counts, on='_entity', how='left')
    else:
        agg['unique_dst_ips'] = 0

    if port_col:
        port_counts = df.groupby('_entity')[port_col].nunique().reset_index().rename(columns={port_col:'unique_dst_ports'})
        agg = agg.merge(port_counts, on='_entity', how='left')
    else:
        agg['unique_dst_ports'] = 0

    # protocol entropy
    def proto_entropy(g):
        if proto_col and proto_col in g:
            return entropy_from_counts(g[proto_col].value_counts().values)
        return 0.0
    ent = df.groupby('_entity').apply(proto_entropy).reset_index().rename(columns={0:'proto_entropy'})
    agg = agg.merge(ent, on='_entity', how='left')

    # label per entity: mark as attack if any flow labeled attack
    if label_exists:
        lbl = df.groupby('_entity')['Label'].max().reset_index().rename(columns={'Label':'entity_label'})
        agg = agg.merge(lbl, on='_entity', how='left')
    else:
        agg['entity_label'] = -1

    os.makedirs(out_dir, exist_ok=True)
    features_path = os.path.join(out_dir, 'features.csv')
    agg.to_csv(features_path, index=False)
    print("Saved features:", features_path)

    # if labeled, produce train/test split (entity-level)
    if 'entity_label' in agg.columns and agg['entity_label'].isin([0,1]).any():
        labeled = agg[agg['entity_label'].isin([0,1])]
        X = labeled.drop(columns=['_entity','entity_label'])
        y = labeled['entity_label']
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
        train_df = X_train.copy(); train_df['entity_label'] = y_train.values
        test_df = X_test.copy(); test_df['entity_label'] = y_test.values
        train_df.to_csv(os.path.join(out_dir, 'train.csv'), index=False)
        test_df.to_csv(os.path.join(out_dir, 'test.csv'), index=False)
        print("Saved train/test splits in", out_dir)
    else:
        # unsupervised path: split features randomly for evaluation
        X = agg.drop(columns=['_entity','entity_label'])
        X_train, X_test = train_test_split(X, test_size=0.2, random_state=42)
        X_train.to_csv(os.path.join(out_dir, 'train_unsup.csv'), index=False)
        X_test.to_csv(os.path.join(out_dir, 'test_unsup.csv'), index=False)
        print("Saved unsupervised train/test splits in", out_dir)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--clean", default="data/cleaned/cleaned.csv")
    parser.add_argument("--out", default="data/features")
    args = parser.parse_args()
    main(args.clean, args.out)
