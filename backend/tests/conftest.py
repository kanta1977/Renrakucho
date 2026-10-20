import os
import tempfile

import pytest

# アプリを読み込む前に、テスト用の DB に切り替える
_tmpdir = tempfile.mkdtemp()
os.environ["CHAT_DATABASE_URL"] = f"sqlite:///{_tmpdir}/test.db"
os.environ["CHAT_PASSWORD_ITERATIONS"] = "1000"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    with TestClient(app) as c:
        yield c


PASSWORD = "sizuko1234"


class Person:
    def __init__(self, client: TestClient, name: str, password: str = PASSWORD):
        res = client.post("/api/auth/register", json={"username": name, "password": password})
        assert res.status_code == 201, res.text
        body = res.json()
        self.token: str = body["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.id: int = body["user"]["id"]
        self.name: str = body["user"]["username"]
        self.code: str = body["user"]["friend_code"]


def befriend(client: TestClient, a: Person, b: Person) -> int:
    res = client.post("/api/friends", json={"friend_code": b.code}, headers=a.headers)
    assert res.status_code == 201, res.text
    friends = client.get("/api/home", headers=a.headers).json()["friends"]
    return next(f["room_id"] for f in friends if f["user"]["id"] == b.id)
