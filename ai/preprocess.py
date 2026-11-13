import json
import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler

from ai.config import (
    CLASSES, COL_CLASS, COL_SCENARIO, DATA_PROCESSED, DATASET_CSV,
    DROP_COLUMNS, FIGURES_DIR, MAX_DOS_ROWS, MODELS_DIR, REPORTS_DIR,
    SEED, TEST_SIZE, VAL_SIZE,
)

CORR_THRESHOLD = 0.98

def load() -> pd.DataFrame:
    if not DATASET_CSV.exists():
        raise SystemExit(f"{DATASET_CSV} absent")
    return pd.read_csv(DATASET_CSV)

def fix_labels(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    mask = (
        df[COL_SCENARIO].str.contains("udp-flood", case=False) &
        (df["protocol"] == 17) &
        (df[COL_CLASS] == "Benign")
    )
    df = df.copy()
    df.loc[mask, COL_CLASS] = "DoS"
    return df, int(mask.sum())

def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    info = {}
    feats = [c for c in df.columns if c not in DROP_COLUMNS]
    df = df.replace([np.inf, -np.inf], np.nan).dropna(subset=feats)
    before = len(df)
    key = pd.util.hash_pandas_object(df[feats], index=False)
    conflicts = df.groupby(key)[COL_CLASS].transform(lambda x: len(x.unique())) > 1
    df = df[~conflicts.to_numpy()]
    info["conflicting_rows_removed"] = int(conflicts.sum())
    df = df.drop_duplicates(subset=feats + [COL_CLASS])
    info["duplicates_removed"] = int(before - len(df) - info["conflicting_rows_removed"])
    dos = df[df[COL_CLASS] == "DoS"]
    if len(dos) > MAX_DOS_ROWS:
        keep = dos.sample(n=MAX_DOS_ROWS, random_state=SEED).index
        df = pd.concat([df[df[COL_CLASS] != "DoS"], df.loc[keep]]).sort_index()
        info["dos_rows_dropped_by_cap"] = int(len(dos) - MAX_DOS_ROWS)
    info["rows_after_cleaning"] = int(len(df))
    info["class_counts_after_cleaning"] = {k: int(v) for k, v in df[COL_CLASS].value_counts().items()}
    return df, info

def select_features(X_train: pd.DataFrame) -> tuple[list[str], dict]:
    # CORRECTION ICI
    constant = [c for c in X_train.columns if len(X_train[c].unique()) <= 1]
    X = X_train.drop(columns=constant)
    corr = X.corr().abs()
    upper = corr.where(np.triu(np.ones(corr.shape, dtype=bool), k=1))
    correlated = [c for c in upper.columns if (upper[c] > CORR_THRESHOLD).any()]
    kept = [c for c in X.columns if c not in correlated]
    return kept, {"constant_removed": constant, "correlated_removed": correlated, "kept": len(kept)}

def main() -> None:
    for d in (DATA_PROCESSED, MODELS_DIR, REPORTS_DIR):
        d.mkdir(parents=True, exist_ok=True)
    df = load()
    print(f"Charge : {df.shape[0]} lignes x {df.shape[1]} colonnes")
    df, relabeled = fix_labels(df)
    print(f"Re-etiquetes Benign -> DoS : {relabeled}")
    df, info = clean(df)
    print("Apres nettoyage :", info["class_counts_after_cleaning"])
    y = df[COL_CLASS].map({c: i for i, c in enumerate(CLASSES)}).to_numpy()
    X = df.drop(columns=DROP_COLUMNS).astype("float64")
    X_tmp, X_test, y_tmp, y_test = train_test_split(X, y, test_size=TEST_SIZE, stratify=y, random_state=SEED)
    X_train, X_val, y_train, y_val = train_test_split(X_tmp, y_tmp, test_size=VAL_SIZE/(1-TEST_SIZE), stratify=y_tmp, random_state=SEED)
    features, sel = select_features(X_train)
    print(f"Attributs : {X.shape[1]} -> {len(features)} apres selection")
    X_train, X_val, X_test = X_train[features], X_val[features], X_test[features]
    preprocessor = make_pipeline(FunctionTransformer(np.log1p, feature_names_out="one-to-one"), StandardScaler())
    preprocessor.fit(X_train)
    joblib.dump(preprocessor, MODELS_DIR / "preprocessor.joblib")
    splits = {"features": features, "classes": CLASSES,
              "X_train": X_train, "y_train": y_train,
              "X_val": X_val, "y_val": y_val,
              "X_test": X_test, "y_test": y_test}
    joblib.dump(splits, DATA_PROCESSED / "splits.joblib", compress=3)
    print("Pre-traitement termine.")

if __name__ == "__main__":
    main()
