"""Genere data/processed/demo_flows.json (flux d'exemple par classe) a partir des splits d'entrainement.
Usage : python -m ai.generate_demo_flows  (apres python -m ai.preprocess)"""
import json
import joblib
import numpy as np
from ai.config import DATA_PROCESSED, SEED

s = joblib.load(DATA_PROCESSED / "splits.joblib")
X_test, y_test = s["X_test"], s["y_test"]
classes = s["classes"]
features = s["features"]

rng = np.random.default_rng(SEED)
demo = []
for i, c in enumerate(classes):
    idx = np.flatnonzero(y_test == i)
    for j in rng.choice(idx, size=min(25, len(idx)), replace=False):
        demo.append({
            "label": c,
            "features": {f: float(v) for f, v in X_test.iloc[j].items()}
        })

(DATA_PROCESSED / "demo_flows.json").write_text(json.dumps(demo, indent=1))
print(f"Généré {len(demo)} flux de démonstration dans {DATA_PROCESSED / 'demo_flows.json'}")
