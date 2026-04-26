# src/ingest/parse_logs.py
import os
import argparse
import pandas as pd

COMMON_LABEL_COLS = ['Label', 'label', 'Class', 'class', 'Attack', 'attack', 'Category', 'category']

def detect_label_col(df):
    for c in COMMON_LABEL_COLS:
        if c in df.columns:
            return c
    # try fuzzy: any col containing 'label' or 'attack'
    for c in df.columns:
        if 'label' in c.lower() or 'attack' in c.lower():
            return c
    return None

def map_label(series):
    # Map known benign strings to 0, everything else to 1
    def map_val(v):
        if pd.isnull(v):
            return None
        s = str(v).lower()
        if 'benign' in s or 'normal' in s or 'normal.' in s:
            return 0
        # some files use 0/1 already
        if s in ('0', '0.0'):
            return 0
        if s in ('1', '1.0'):
            return 1
        # else treat as attack
        return 1
    return series.apply(map_val)

def main(input_dir, out_path):
    files = [os.path.join(input_dir, f) for f in os.listdir(input_dir) if f.lower().endswith('.csv') or f.lower().endswith('.txt')]
    if not files:
        raise SystemExit(f"No CSV/TXT files found in {input_dir}")
    dfs = []
    for f in files:
        try:
            df = pd.read_csv(f, low_memory=False)
            print(f"Loaded {f} -> shape {df.shape}")
        except Exception as e:
            print(f"Failed reading {f}: {e} - skipping")
            continue
        dfs.append(df)
    df = pd.concat(dfs, ignore_index=True, sort=False)
    print("Combined shape:", df.shape)

    # drop columns that are completely empty
    df = df.dropna(axis=1, how='all')

    # detect label column and normalize to 'Label'
    label_col = detect_label_col(df)
    if label_col:
        df['Label'] = map_label(df[label_col])
        print(f"Detected label column '{label_col}' -> normalized to 'Label'")
    else:
        print("No label column detected; running in unsupervised mode (Label=None)")

    # drop exact duplicate rows
    before = df.shape[0]
    df = df.drop_duplicates()
    after = df.shape[0]
    print(f"Dropped {before-after} duplicate rows")

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    df.to_csv(out_path, index=False)
    print("Saved cleaned data to", out_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", default="data/raw", help="directory with raw CSV logs")
    parser.add_argument("--out", default="data/cleaned/cleaned.csv", help="cleaned output csv")
    args = parser.parse_args()
    main(args.input_dir, args.out)
