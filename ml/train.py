"""Train models to predict a student's final grade (G3).

Run:  python train.py

Two experiments:
  1. full  - uses all columns, including the earlier grades G1 and G2
  2. early - drops G1 and G2 (a realistic "predict early" scenario)
The best "early" model is saved for the API.
"""
import io
import json
import urllib.request
import zipfile
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBRegressor

ROOT = Path(__file__).parent
DATA_FILE = ROOT / "data" / "student-mat.csv"
MODEL_DIR = ROOT / "models"
REPORT_DIR = ROOT / "reports"
URL = "https://archive.ics.uci.edu/static/public/320/student+performance.zip"

CATEGORICAL = ["school", "sex", "address", "famsize", "Pstatus", "Mjob", "Fjob",
               "reason", "guardian", "schoolsup", "famsup", "paid", "activities",
               "nursery", "higher", "internet", "romantic"]
NUMERIC = ["age", "Medu", "Fedu", "traveltime", "studytime", "failures", "famrel",
           "freetime", "goout", "health", "absences"]


def load_data():
    """Read the CSV (download it from UCI the first time)."""
    if not DATA_FILE.exists():
        DATA_FILE.parent.mkdir(exist_ok=True)
        data = urllib.request.urlopen(URL, timeout=60).read()
        outer = zipfile.ZipFile(io.BytesIO(data))
        # the UCI download is a zip that contains another zip (student.zip)
        inner = zipfile.ZipFile(io.BytesIO(outer.read("student.zip")))
        DATA_FILE.write_bytes(inner.read("student-mat.csv"))
    return pd.read_csv(DATA_FILE, sep=";")


def build_pipeline(model, numeric_cols):
    """Preprocessing + model in one Pipeline."""
    prep = ColumnTransformer([
        ("num", StandardScaler(), numeric_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL),
    ])
    return Pipeline([("prep", prep), ("model", model)])


def scores(y_true, y_pred):
    y_pred = np.clip(y_pred, 0, 20)
    return {
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "r2": float(r2_score(y_true, y_pred)),
    }


def run_experiment(df, name, numeric_cols):
    X = df[CATEGORICAL + numeric_cols]
    y = df["G3"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # model -> small grid of settings to try
    models = {
        "Linear Regression": (LinearRegression(), {}),
        "Random Forest": (RandomForestRegressor(random_state=42),
                          {"model__n_estimators": [100, 300], "model__max_depth": [4, 8, None]}),
        "XGBoost": (XGBRegressor(random_state=42),
                    {"model__n_estimators": [100, 300], "model__max_depth": [2, 3, 4],
                     "model__learning_rate": [0.03, 0.1]}),
    }

    results, fitted = {}, {}
    for model_name, (model, grid) in models.items():
        pipe = build_pipeline(model, numeric_cols)
        if grid:
            search = GridSearchCV(pipe, grid, cv=5, scoring="neg_root_mean_squared_error")
            search.fit(X_train, y_train)
            pipe, cv_rmse = search.best_estimator_, -search.best_score_
        else:
            cv_rmse = -cross_val_score(pipe, X_train, y_train, cv=5,
                                       scoring="neg_root_mean_squared_error").mean()
            pipe.fit(X_train, y_train)
        results[model_name] = {"cv_rmse": float(cv_rmse), **scores(y_test, pipe.predict(X_test))}
        fitted[model_name] = pipe
        print(name, model_name, {k: round(v, 2) for k, v in results[model_name].items()})

    best = min(results, key=lambda m: results[m]["cv_rmse"])
    return results, best, fitted[best], X_test


def save_plots(pipe, X_test):
    """Feature importance + SHAP plots for the final model."""
    REPORT_DIR.mkdir(exist_ok=True)
    prep, model = pipe.named_steps["prep"], pipe.named_steps["model"]
    X_enc = prep.transform(X_test)
    names = [n.split("__", 1)[1] for n in prep.get_feature_names_out()]

    if hasattr(model, "feature_importances_"):
        top = pd.Series(model.feature_importances_, index=names).nlargest(15).sort_values()
        top.plot.barh(figsize=(7, 5), title="Top 15 feature importances")
        plt.tight_layout()
        plt.savefig(REPORT_DIR / "feature_importance.png", dpi=120)
        plt.close()
        shap_values = shap.TreeExplainer(model).shap_values(X_enc)
    else:
        shap_values = shap.LinearExplainer(model, X_enc).shap_values(X_enc)

    shap.summary_plot(shap_values, X_enc, feature_names=names, show=False, max_display=15)
    plt.tight_layout()
    plt.savefig(REPORT_DIR / "shap_summary.png", dpi=120, bbox_inches="tight")
    plt.close()


def main():
    df = load_data()
    print("Rows:", len(df), "| missing values:", int(df.isna().sum().sum()))
    MODEL_DIR.mkdir(exist_ok=True)

    full, full_best, _, _ = run_experiment(df, "full", NUMERIC + ["G1", "G2"])
    early, early_best, pipe, X_test = run_experiment(df, "early", NUMERIC)

    save_plots(pipe, X_test)
    joblib.dump(pipe, MODEL_DIR / "model.joblib")

    # Info the form / API needs (options for dropdowns, ranges for sliders)
    features = [{"name": c, "type": "category", "options": sorted(df[c].unique().tolist())}
                for c in CATEGORICAL]
    features += [{"name": c, "type": "number", "min": int(df[c].min()), "max": int(df[c].max())}
                 for c in NUMERIC]

    metrics = {
        "best_model": early_best,
        "best_scores": early[early_best],
        "early": early,
        "full": full,
        "features": features,
    }
    (MODEL_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))

    # results table for the README
    rows = ["| Experiment | Model | CV RMSE | Test RMSE | Test MAE | Test R2 |", "|---|---|---|---|---|---|"]
    for label, res in (("With G1/G2", full), ("Without G1/G2", early)):
        for m, r in res.items():
            rows.append(f"| {label} | {m} | {r['cv_rmse']:.2f} | {r['rmse']:.2f} | {r['mae']:.2f} | {r['r2']:.2f} |")
    (REPORT_DIR / "results.md").write_text("\n".join(rows) + "\n")
    print("\n".join(rows))
    print("Saved model:", early_best)


if __name__ == "__main__":
    main()
