"""Server tests with a fake Atlas client (no network, no credits)."""
import pytest
from fastapi.testclient import TestClient

from app import server
from app.atlas import AtlasError
from app.midi import read_midi, write_midi

SECRET = "moth_test_secret_should_never_leak"
NOTES = [[i * 0.5, 0.5, 60 + i, 90] for i in range(8)]


class FakeAtlas:
    def __init__(self):
        self.statuses, self.uploads, self.fail_submit = {}, [], False

    def upload(self, data, filename, content_type):
        self.uploads.append(data)
        return "asset-1"

    def submit(self, engine, params, input_files):
        if self.fail_submit:
            raise AtlasError(503, f"upstream said {SECRET}")
        job_id = f"job-{len(self.statuses) + 1}"
        self.statuses[job_id] = "queued"
        return job_id

    def status(self, job_id):
        return {"status": self.statuses[job_id]}

    def result_bytes(self, job_id):
        if self.statuses[job_id] != "completed":
            raise AtlasError(409, "not complete")
        return write_midi(NOTES[:3], 90)

    def result_json(self, job_id):
        if self.statuses[job_id] != "completed":
            raise AtlasError(409, "not complete")
        return {"tomography": {"relationships": {"0,1": {"XX": 0.5}}}}


@pytest.fixture
def fake():
    return FakeAtlas()


@pytest.fixture
def client(fake):
    return TestClient(server.create_app(atlas=fake))


def test_health(client):
    assert client.get("/api/health").json() == {"ok": True}


def test_root_points_to_the_diary(client):
    r = client.get("/")
    assert r.status_code == 200 and "diary/" in r.text


def test_midi_round_trip():
    notes = [[0, 0.5, 60, 90], [0.5, 1, 64, 70], [2, 0.5, 67, 100]]
    assert read_midi(write_midi(notes, 100)) == notes


def test_diary_graph_flow(client, fake):
    r = client.post("/api/diary/graph", json={"n": 4, "links": [[0, 1], [1, 2], [2, 3]], "seed": 42})
    assert r.status_code == 200 and r.json()["engine"] == "graph-v1"
    job_id = r.json()["job_id"]
    assert client.get(f"/api/jobs/{job_id}").json() == {"status": "queued"}
    fake.statuses[job_id] = "fetching"
    assert client.get(f"/api/jobs/{job_id}").json() == {"status": "processing"}
    assert client.get(f"/api/jobs/{job_id}/values").status_code == 409
    fake.statuses[job_id] = "completed"
    assert client.get(f"/api/jobs/{job_id}/values").json()["values"]["tomography"]["relationships"]["0,1"] == {"XX": 0.5}


def test_diary_song_flow(client, fake):
    r = client.post("/api/diary/song", json={"bpm": 90, "notes": NOTES, "velocity": 100, "seed": 7})
    assert r.status_code == 200 and r.json()["engine"] == "qrc-midi-v1" and fake.uploads[-1][:4] == b"MThd"
    job_id = r.json()["job_id"]
    assert client.get(f"/api/jobs/{job_id}/notes").status_code == 409
    fake.statuses[job_id] = "completed"
    assert client.get(f"/api/jobs/{job_id}/notes").json() == {"notes": NOTES[:3]}


@pytest.mark.parametrize("body", [{"n": 1, "links": [[0, 0]], "seed": 1}, {"n": 3, "links": [[0, 5]], "seed": 1},
                                  {"n": 3, "links": [], "seed": 1}, {"n": 3, "links": [[0, 1]]}, {"n": 99, "links": [[0, 1]], "seed": 1}])
def test_diary_graph_rejects_bad_input(client, body):
    assert client.post("/api/diary/graph", json=body).status_code == 400


def test_diary_song_rejects_bad_input(client):
    assert client.post("/api/diary/song", json={"bpm": 90, "notes": [[0, 1, 60, 90]], "velocity": 100, "seed": 1}).status_code == 400
    assert client.post("/api/diary/song", json={"bpm": 90, "notes": [[0, 1, 60, 90]] * 5, "velocity": 999, "seed": 1}).status_code == 400
    assert client.post("/api/diary/song", json={"bpm": 999, "notes": NOTES, "velocity": 100, "seed": 1}).status_code == 400


def test_unknown_jobs_are_404(client):
    for path in ("/api/jobs/someone-elses-job", "/api/jobs/someone-elses-job/values", "/api/jobs/someone-elses-job/notes"):
        assert client.get(path).status_code == 404


def test_engine_errors_never_leak_details(client, fake):
    fake.fail_submit = True
    r = client.post("/api/diary/graph", json={"n": 3, "links": [[0, 1]], "seed": 1})
    assert r.status_code == 503 and SECRET not in r.text and "upstream" not in r.text


def test_diary_rate_limit_per_ip(client):
    body = {"n": 3, "links": [[0, 1]], "seed": 1}
    for _ in range(server.DIARY_PER_IP_PER_HOUR):
        assert client.post("/api/diary/graph", json=body, headers={"x-forwarded-for": "1.2.3.4"}).status_code == 200
    assert client.post("/api/diary/graph", json=body, headers={"x-forwarded-for": "1.2.3.4"}).status_code == 429
    assert client.post("/api/diary/graph", json=body, headers={"x-forwarded-for": "5.6.7.8"}).status_code == 200


def test_rate_limiter_per_ip_and_global():
    rl = server.RateLimiter(per_ip=2, total=3)
    assert rl.allow("a") and rl.allow("a")
    assert not rl.allow("a")          # per-IP cap
    assert rl.allow("b")
    assert not rl.allow("c")          # global cap
