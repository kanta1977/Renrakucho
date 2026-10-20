import re

from tests.conftest import PASSWORD, Person


def test_register_issues_six_digit_number(client):
    res = client.post("/api/auth/register", json={"username": "山本静子", "password": PASSWORD})
    assert res.status_code == 201
    user = res.json()["user"]
    assert user["username"] == "山本静子"
    assert re.fullmatch(r"[1-9]\d{5}", user["friend_code"])
    assert "password" not in str(res.json()) and "pbkdf2" not in str(res.json())


def test_password_rules(client):
    for bad in ["abc123", "abcdefgh", "12345678", "あいうえお1234", "has space1"]:
        res = client.post("/api/auth/register", json={"username": "静子", "password": bad})
        assert res.status_code == 422, bad
    assert client.post("/api/auth/register", json={"username": "静子", "password": "Abc12345!"}).status_code == 201


def test_password_is_hashed_not_stored(client):
    from app.database import SessionLocal
    from app.models import User

    a = Person(client, "静子")
    with SessionLocal() as db:
        stored = db.get(User, a.id).password_hash
    assert PASSWORD not in stored
    assert stored.startswith("pbkdf2_sha256$")
    b = Person(client, "花子")
    with SessionLocal() as db:
        assert db.get(User, b.id).password_hash != stored


def test_same_name_gets_different_people_and_numbers(client):
    a, b = Person(client, "山本 静子"), Person(client, "山本 静子")
    assert a.id != b.id
    assert a.code != b.code


def test_resume_needs_number_and_password(client):
    a = Person(client, "静子")
    res = client.post("/api/auth/resume", json={"friend_code": a.code, "password": PASSWORD})
    assert res.status_code == 200
    assert res.json()["user"]["id"] == a.id

    wrong_pw = client.post("/api/auth/resume", json={"friend_code": a.code, "password": "wrong1234"})
    wrong_no = client.post("/api/auth/resume", json={"friend_code": "999999", "password": PASSWORD})
    assert wrong_pw.status_code == wrong_no.status_code == 401
    assert wrong_pw.json()["detail"] == wrong_no.json()["detail"]


def test_resume_accepts_hyphen_and_fullwidth(client):
    a = Person(client, "静子")
    formatted = f"{a.code[:3]}-{a.code[3:]}"
    fullwidth = formatted.translate(str.maketrans("0123456789-", "０１２３４５６７８９ー"))
    for code in (formatted, fullwidth, f" {a.code[:3]} {a.code[3:]} "):
        res = client.post("/api/auth/resume", json={"friend_code": code, "password": PASSWORD})
        assert res.status_code == 200, code


def test_name_variations_are_normalized(client):
    assert Person(client, "山本　静子").name == "山本 静子"
    assert Person(client, "ＴＡＲＯ").name == "TARO"


def test_invalid_names_rejected(client):
    for name in ["", "   ", "あ" * 21, "a\x01b"]:
        res = client.post("/api/auth/register", json={"username": name, "password": PASSWORD})
        assert res.status_code == 422, name


def test_me_and_logout(client):
    assert client.get("/api/auth/me").status_code == 401
    a = Person(client, "佐藤")
    me = client.get("/api/auth/me", headers=a.headers).json()
    assert me == {"id": a.id, "username": "佐藤", "friend_code": a.code}
    assert client.post("/api/auth/logout", headers=a.headers).status_code == 204
    assert client.get("/api/auth/me", headers=a.headers).status_code == 401
