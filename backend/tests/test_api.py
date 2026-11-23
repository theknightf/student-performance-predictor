import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent))
from main import app  # noqa: E402


def test_health():
    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}


def test_model_info():
    with TestClient(app) as client:
        data = client.get("/model-info").json()
        assert "best_model" in data
        assert "rmse" in data["best_scores"]
        assert len(data["features"]) > 20


def test_predict_returns_grade_and_5_factors():
    with TestClient(app) as client:
        r = client.post("/predict", json={})  # all fields have defaults
        assert r.status_code == 200
        body = r.json()
        assert 0 <= body["predicted_grade"] <= 20
        assert isinstance(body["passed"], bool)
        assert len(body["top_factors"]) == 5
        assert body["top_factors"][0]["direction"] in ("up", "down")


def test_more_failures_lowers_grade():
    with TestClient(app) as client:
        good = client.post("/predict", json={"failures": 0, "studytime": 4}).json()
        bad = client.post("/predict", json={"failures": 3, "studytime": 1}).json()
        assert bad["predicted_grade"] < good["predicted_grade"]


def test_invalid_input_rejected():
    with TestClient(app) as client:
        assert client.post("/predict", json={"age": 50}).status_code == 422
        assert client.post("/predict", json={"internet": "maybe"}).status_code == 422
