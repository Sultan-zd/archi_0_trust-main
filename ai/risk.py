from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from ai.config import MODELS_DIR

BENIGN = 0

class RiskEngine:
    def __init__(self, bundle_path: Path | str = MODELS_DIR / "risk_bundle.joblib"):
        b = joblib.load(bundle_path)
        self.features = b["features"]
        self.classes = b["classes"]
        self.pre = b["preprocessor"]
        self.rf = b["rf"]
        self.iforest = b["iforest"]
        self.if_ref = b["if_ref"]
        self.ae = b["autoencoder"]
        self.ae_ref = b["ae_ref"]
        self.fusion = b["fusion"]
        self.meta = b["meta"]

    @staticmethod
    def _ecdf(raw: float, ref: np.ndarray) -> float:
        return float(np.searchsorted(ref, raw, side="right") / len(ref))

    def score(self, flow: dict) -> dict:
        missing = [f for f in self.features if f not in flow]
        row = pd.DataFrame([[float(flow.get(f, 0.0)) for f in self.features]], columns=self.features)
        xs = self.pre.transform(row)

        proba = self.rf.predict_proba(row)[0]
        p_rf = 1.0 - float(proba[BENIGN])
        p_if = self._ecdf(float(-self.iforest.score_samples(xs)[0]), self.if_ref)
        err = float(np.mean((self.ae.predict(xs) - xs) ** 2))
        p_ae = self._ecdf(err, self.ae_ref)
        p = float(self.fusion.predict_proba([[p_rf, p_if, p_ae]])[0, 1])

        return {
            "ai_risk": int(round(100 * p)),
            "predicted_class": self.classes[int(np.argmax(proba))],
            "components": {
                "random_forest": round(p_rf, 4),
                "isolation_forest": round(p_if, 4),
                "autoencoder": round(p_ae, 4),
            },
            "missing_features": missing,
        }
