import json, platform, time, joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
import xgboost
from imblearn.over_sampling import SMOTE
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (ConfusionMatrixDisplay, RocCurveDisplay, accuracy_score,
                             balanced_accuracy_score, confusion_matrix, f1_score,
                             precision_score, recall_score, roc_auc_score)
from sklearn.neural_network import MLPRegressor
from sklearn.utils.class_weight import compute_sample_weight
from xgboost import XGBClassifier
from ai.config import (CLASSES, DATA_PROCESSED, DEFAULT_DENY_THRESHOLD,
                       DEFAULT_MFA_THRESHOLD, FIGURES_DIR, MODELS_DIR,
                       REPORTS_DIR, SEED)

BENIGN = 0

def ecdf_score(raw, benign_ref):
    return np.searchsorted(benign_ref, raw, side="right") / len(benign_ref)

def ae_errors(ae, Xs):
    return np.mean((ae.predict(Xs) - Xs) ** 2, axis=1)

def single_row_latency_ms(fn, X, n=200):
    rows = [X.iloc[[i]] for i in range(min(n, len(X)))]
    fn(rows[0])
    t0 = time.perf_counter()
    for r in rows: fn(r)
    return (time.perf_counter() - t0) / len(rows) * 1000

def wilson(k, n, z=1.96):
    if n == 0: return [0.0, 1.0]
    p = k / n
    centre = (p + z*z/(2*n)) / (1 + z*z/n)
    half = z * np.sqrt(p*(1-p)/n + z*z/(4*n*n)) / (1 + z*z/n)
    return [round(max(0.0, centre-half), 4), round(min(1.0, centre+half), 4)]

def binary_metrics(y_true_attack, y_pred_attack, p_attack):
    return {
        "accuracy": accuracy_score(y_true_attack, y_pred_attack),
        "balanced_accuracy": balanced_accuracy_score(y_true_attack, y_pred_attack),
        "precision_attack": precision_score(y_true_attack, y_pred_attack, zero_division=0),
        "recall_attack": recall_score(y_true_attack, y_pred_attack, zero_division=0),
        "f1_attack": f1_score(y_true_attack, y_pred_attack, zero_division=0),
        "recall_benign": recall_score(1-y_true_attack, 1-y_pred_attack, zero_division=0),
        "roc_auc": roc_auc_score(y_true_attack, p_attack),
    }

def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    s = joblib.load(DATA_PROCESSED / "splits.joblib")
    pre = joblib.load(MODELS_DIR / "preprocessor.joblib")
    features = s["features"]
    X_tr, y_tr, X_va, y_va, X_te, y_te = (s[k] for k in ("X_train", "y_train", "X_val", "y_val", "X_test", "y_test"))
    att_va, att_te = (y_va != BENIGN).astype(int), (y_te != BENIGN).astype(int)
    Xs_tr, Xs_va, Xs_te = pre.transform(X_tr), pre.transform(X_va), pre.transform(X_te)
    Xs_tr_benign = Xs_tr[y_tr == BENIGN]

    print(f"Entrainement : {len(y_tr)} flux dont {len(Xs_tr_benign)} legitimes : {len(features)} attributs")

    results, rocs, models = [], {}, {}
    sup_specs = {
        "Régression logistique": (LogisticRegression(max_iter=3000, class_weight="balanced"), "scaled", None),
        "Random Forest": (RandomForestClassifier(n_estimators=100, criterion="gini", class_weight="balanced_subsample", n_jobs=-1, random_state=SEED), "raw", None),
        "Random Forest + SMOTE": (RandomForestClassifier(n_estimators=100, n_jobs=-1, random_state=SEED), "raw", "smote"),
        "XGBoost": (XGBClassifier(n_estimators=300, max_depth=6, learning_rate=0.1, tree_method="hist", eval_metric="mlogloss", n_jobs=-1, random_state=SEED), "raw", "weights"),
    }
    for name, (model, space, balance) in sup_specs.items():
        Xfit = Xs_tr if space == "scaled" else X_tr
        yfit, kw = y_tr, {}
        if balance == "smote":
            Xfit, yfit = SMOTE(sampling_strategy={BENIGN: 5000}, k_neighbors=5, random_state=SEED).fit_resample(Xfit, yfit)
        if balance == "weights":
            kw["sample_weight"] = compute_sample_weight("balanced", yfit)
        t0 = time.perf_counter()
        model.fit(Xfit, yfit, **kw)
        train_s = time.perf_counter() - t0
        model.set_params(n_jobs=1)
        Xval = Xs_va if space == "scaled" else X_va
        pred_va = model.predict_proba(Xval).argmax(axis=1)
        val_bal_acc = balanced_accuracy_score(att_va, (pred_va != BENIGN).astype(int))
        Xeval = Xs_te if space == "scaled" else X_te
        proba = model.predict_proba(Xeval)
        pred = proba.argmax(axis=1)
        p_attack = 1 - proba[:, BENIGN]
        m = binary_metrics(att_te, (pred != BENIGN).astype(int), p_attack)
        m.update({"val_balanced_accuracy": val_bal_acc, "accuracy_multiclass": accuracy_score(y_te, pred),
                  "f1_macro_multiclass": f1_score(y_te, pred, average="macro"), "train_seconds": train_s,
                  "latency_ms_one_request": single_row_latency_ms(
                      (lambda r, mdl=model: mdl.predict_proba(pre.transform(r))) if space == "scaled" else (lambda r, mdl=model: mdl.predict_proba(r)), X_te),
                  "confusion_matrix": confusion_matrix(y_te, pred, labels=[0,1,2]).tolist()})
        results.append({"model": name, "type": "supervise", **m}); rocs[name] = p_attack; models[name] = model
        print(f"{name:24s} F1 attaque={m['f1_attack']:.4f} rappel Benign={m['recall_benign']:.3f} AUC={m['roc_auc']:.4f}")

    iforest = IsolationForest(n_estimators=100, contamination=0.1, random_state=SEED)
    t0 = time.perf_counter(); iforest.fit(Xs_tr_benign); if_train = time.perf_counter() - t0
    if_ref = np.sort(-iforest.score_samples(Xs_tr_benign))
    ae = MLPRegressor(hidden_layer_sizes=(64,32,64), activation="relu", solver="adam",
                      learning_rate_init=1e-3, alpha=1e-3, max_iter=2000, early_stopping=False, random_state=SEED)
    t0 = time.perf_counter(); ae.fit(Xs_tr_benign, Xs_tr_benign); ae_train = time.perf_counter() - t0
    ae_ref = np.sort(ae_errors(ae, Xs_tr_benign))

    for name, raw_te, ref, train_s, fn in [
        ("Isolation Forest", -iforest.score_samples(Xs_te), if_ref, if_train, lambda r: iforest.score_samples(pre.transform(r))),
        ("Autoencoder", ae_errors(ae, Xs_te), ae_ref, ae_train, lambda r: ae.predict(pre.transform(r)))]:
        score = ecdf_score(raw_te, ref)
        pred_attack = (score >= 0.95).astype(int)
        m = binary_metrics(att_te, pred_attack, score)
        m.update({"train_seconds": train_s, "latency_ms_one_request": single_row_latency_ms(fn, X_te),
                  "confusion_matrix": confusion_matrix(att_te, pred_attack, labels=[0,1]).tolist()})
        results.append({"model": name, "type": "non supervise", **m}); rocs[name] = score
        print(f"{name:24s} F1 attaque={m['f1_attack']:.4f} rappel Benign={m['recall_benign']:.3f} AUC={m['roc_auc']:.4f}")

    rf_candidates = ["Random Forest", "Random Forest + SMOTE"]
    rf_name = max(rf_candidates, key=lambda n: next(r["val_balanced_accuracy"] for r in results if r["model"] == n))
    rf = models[rf_name]
    print(f"Composant supervise retenu pour la fusion (validation) : {rf_name}")

    def components(X_raw, Xs):
        return np.column_stack([1 - rf.predict_proba(X_raw)[:, BENIGN], ecdf_score(-iforest.score_samples(Xs), if_ref), ecdf_score(ae_errors(ae, Xs), ae_ref)])

    C_va, C_te = components(X_va, Xs_va), components(X_te, Xs_te)
    fixed_w = np.array([0.6, 0.2, 0.2])
    p_fixed = C_te @ fixed_w
    fusion = LogisticRegression(class_weight="balanced", max_iter=1000).fit(C_va, att_va)
    p_learned = fusion.predict_proba(C_te)[:, 1]

    for name, p in [("Fusion poids fixes (RF+IF+AE)", p_fixed), ("Fusion apprise (RF+IF+AE)", p_learned)]:
        m = binary_metrics(att_te, (p >= DEFAULT_DENY_THRESHOLD/100).astype(int), p)
        m["confusion_matrix"] = confusion_matrix(att_te, (p >= 0.6).astype(int), labels=[0,1]).tolist()
        results.append({"model": name, "type": "fusion", **m}); rocs[name] = p
        print(f"{name:24s} F1 attaque={m['f1_attack']:.4f} rappel Benign={m['recall_benign']:.3f} AUC={m['roc_auc']:.4f}")

    risk = np.rint(100 * p_learned).astype(int)
    decision = np.where(risk >= DEFAULT_DENY_THRESHOLD, "DENY", np.where(risk >= DEFAULT_MFA_THRESHOLD, "MFA", "ALLOW"))
    attack, benign = att_te == 1, att_te == 0
    zt = {"thresholds": {"mfa": DEFAULT_MFA_THRESHOLD, "deny": DEFAULT_DENY_THRESHOLD},
          "n_test_attack": int(attack.sum()), "n_test_benign": int(benign.sum()),
          "FAR_allow_only": float((decision[attack] == "ALLOW").mean()),
          "FAR_allow_or_mfa": float((decision[attack] != "DENY").mean()),
          "FRR_deny": float((decision[benign] == "DENY").mean()),
          "benign_mfa_rate": float((decision[benign] == "MFA").mean()),
          "decision_accuracy": float(((decision == "DENY") & attack).sum() + ((decision == "ALLOW") & benign).sum()) / len(att_te),
          "decision_counts_attack": pd.Series(decision[attack]).value_counts().to_dict(),
          "decision_counts_benign": pd.Series(decision[benign]).value_counts().to_dict(),
          "fusion_weights_learned": dict(zip(["rf", "iforest", "autoencoder"], fusion.coef_[0].round(3).tolist())),
          "supervised_component": rf_name}
    zt["FRR_deny_wilson95"] = wilson(int((decision[benign] == "DENY").sum()), int(benign.sum()))
    print("Decisions Zero Trust (test) :", json.dumps(zt, ensure_ascii=False))

    bundle = {"features": features, "classes": CLASSES, "preprocessor": pre,
              "rf": rf, "iforest": iforest, "if_ref": if_ref, "autoencoder": ae, "ae_ref": ae_ref, "fusion": fusion,
              "meta": {"trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                       "python": platform.python_version(), "sklearn": sklearn.__version__,
                       "xgboost": xgboost.__version__,
                       "dataset": "CICEVSE2024 EVSE-A (NFStream, EVCI-Pruning), etiquettes corrigees"}}
    joblib.dump(bundle, MODELS_DIR / "risk_bundle.joblib", compress=3)
    joblib.dump(models["XGBoost"], MODELS_DIR / "xgboost.joblib", compress=3)

    table = pd.DataFrame(results).drop(columns=["confusion_matrix"])
    table.round(4).to_csv(REPORTS_DIR / "model_comparison.csv", index=False)
    (REPORTS_DIR / "metrics.json").write_text(json.dumps({"models": results, "zero_trust_decisions": zt}, indent=2, ensure_ascii=False, default=float))
    print("Modeles sauvegardes dans models/, rapports dans reports/")

if __name__ == "__main__":
    main()
