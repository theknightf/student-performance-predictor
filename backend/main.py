"""FastAPI backend: serves the trained student-grade model."""
import json
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
import shap
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODEL_DIR = Path(__file__).parent / "model"
state = {}  # holds the model, loaded once at startup

YesNo = Literal["yes", "no"]


class StudentInput(BaseModel):
    """Student data. Field names match the dataset columns."""
    school: Literal["GP", "MS"] = "GP"
    sex: Literal["F", "M"] = "F"
    age: int = Field(17, ge=15, le=22)
    address: Literal["U", "R"] = "U"
    famsize: Literal["LE3", "GT3"] = "GT3"
    Pstatus: Literal["T", "A"] = "T"
    Medu: int = Field(2, ge=0, le=4, description="Mother's education 0-4")
    Fedu: int = Field(2, ge=0, le=4, description="Father's education 0-4")
    Mjob: Literal["teacher", "health", "services", "at_home", "other"] = "other"
    Fjob: Literal["teacher", "health", "services", "at_home", "other"] = "other"
    reason: Literal["home", "reputation", "course", "other"] = "course"
    guardian: Literal["mother", "father", "other"] = "mother"
    traveltime: int = Field(1, ge=1, le=4)
    studytime: int = Field(2, ge=1, le=4, description="Weekly study time 1-4")
    failures: int = Field(0, ge=0, le=3, description="Past class failures")
    schoolsup: YesNo = "no"
    famsup: YesNo = "yes"
    paid: YesNo = "no"
    activities: YesNo = "no"
    nursery: YesNo = "yes"
    higher: YesNo = "yes"
    internet: YesNo = "yes"
    romantic: YesNo = "no"
    famrel: int = Field(4, ge=1, le=5)
    freetime: int = Field(3, ge=1, le=5)
    goout: int = Field(3, ge=1, le=5)
    health: int = Field(3, ge=1, le=5)
    absences: int = Field(4, ge=0, le=93)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load the model once, not on every request
    pipe = joblib.load(MODEL_DIR / "model.joblib")
    state["pipe"] = pipe
    state["metrics"] = json.loads((MODEL_DIR / "metrics.json").read_text())
    state["explainer"] = shap.TreeExplainer(pipe.named_steps["model"])
    state["columns"] = [f["name"] for f in state["metrics"]["features"]]
    yield
    state.clear()


app = FastAPI(title="Student Performance Predictor", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


def original_column(encoded_name: str) -> str:
    """'cat__school_GP' -> 'school', 'num__age' -> 'age'"""
    name = encoded_name.split("__", 1)[1]
    for col in state["columns"]:
        if name == col or name.startswith(col + "_"):
            return col
    return name


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/model-info")
def model_info():
    m = state["metrics"]
    return {
        "best_model": m["best_model"],
        "best_scores": m["best_scores"],
        "early": m["early"],
        "full": m["full"],
        "features": m["features"],
    }


@app.post("/predict")
def predict(student: StudentInput):
    row = pd.DataFrame([student.model_dump()])
    pipe = state["pipe"]
    prediction = float(pipe.predict(row)[0])
    grade = round(min(max(prediction, 0), 20), 1)

    # SHAP values are computed per encoded column; add them up per original feature
    encoded = pipe.named_steps["prep"].transform(row)
    shap_values = state["explainer"].shap_values(encoded)[0]
    names = pipe.named_steps["prep"].get_feature_names_out()
    impact = {}
    for name, value in zip(names, shap_values):
        col = original_column(name)
        impact[col] = impact.get(col, 0.0) + float(value)

    top5 = sorted(impact.items(), key=lambda kv: abs(kv[1]), reverse=True)[:5]
    factors = [
        {
            "feature": col,
            "value": row[col].iloc[0].item() if hasattr(row[col].iloc[0], "item") else row[col].iloc[0],
            "impact": round(val, 2),
            "direction": "up" if val >= 0 else "down",
        }
        for col, val in top5
    ]
    return {"predicted_grade": grade, "passed": grade >= 10, "top_factors": factors}
