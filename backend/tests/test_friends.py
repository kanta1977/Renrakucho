from tests.conftest import Person, befriend


def test_home_starts_with_board_and_no_friends(client):
    a = Person(client, "静子")
    h = client.get("/api/home", headers=a.headers).json()
    assert h["me"]["friend_code"] == a.code
    assert h["board"]["unread"] == 0
    assert h["friends"] == []


def test_lookup_shows_who_the_number_belongs_to(client):
    a, b = Person(client, "静子"), Person(client, "花子")
    res = client.get(f"/api/users/by-code/{b.code[:3]}-{b.code[3:]}", headers=a.headers)
    assert res.status_code == 200
    assert res.json() == {"id": b.id, "username": "花子"}

    assert client.get("/api/users/by-code/999999", headers=a.headers).status_code == 404
    res = client.get("/api/users/by-code/12", headers=a.headers)
    assert res.status_code == 400 and "6けた" in res.json()["detail"]
    res = client.get(f"/api/users/by-code/{a.code}", headers=a.headers)
    assert res.status_code == 400 and "ご自身" in res.json()["detail"]


def test_add_friend_by_number_is_mutual(client):
    a, b = Person(client, "静子"), Person(client, "花子")
    room = befriend(client, a, b)
    theirs = client.get("/api/home", headers=b.headers).json()["friends"]
    assert [f["user"]["username"] for f in theirs] == ["静子"]
    assert theirs[0]["room_id"] == room


def test_same_name_friends_are_kept_apart(client):
    me = Person(client, "静子")
    hana1, hana2 = Person(client, "花子"), Person(client, "花子")
    befriend(client, me, hana1)
    befriend(client, me, hana2)
    friends = client.get("/api/home", headers=me.headers).json()["friends"]
    assert sorted(f["user"]["id"] for f in friends) == sorted([hana1.id, hana2.id])
    assert len({f["room_id"] for f in friends}) == 2
    assert all(f["since"] for f in friends)


def test_friend_numbers_never_leak_to_others(client):
    a, b = Person(client, "静子"), Person(client, "花子")
    room = befriend(client, a, b)
    board = client.get("/api/home", headers=a.headers).json()["board"]["room_id"]
    client.post(f"/api/rooms/{room}/messages", json={"content": "こんにちは"}, headers=a.headers)
    client.post(f"/api/rooms/{board}/messages", json={"content": "お知らせ"}, headers=a.headers)

    seen_by_b = " ".join(
        client.get(path, headers=b.headers).text
        for path in ["/api/home", f"/api/rooms/{room}", f"/api/rooms/{room}/messages", f"/api/rooms/{board}/messages"]
    )
    assert a.code not in seen_by_b
    assert b.code in client.get("/api/home", headers=b.headers).text


def test_add_friend_errors_are_friendly(client):
    a, b = Person(client, "静子"), Person(client, "花子")
    res = client.post("/api/friends", json={"friend_code": "999999"}, headers=a.headers)
    assert res.status_code == 404 and "見つかりませんでした" in res.json()["detail"]
    assert client.post("/api/friends", json={"friend_code": a.code}, headers=a.headers).status_code == 400
    befriend(client, a, b)
    res = client.post("/api/friends", json={"friend_code": b.code}, headers=a.headers)
    assert res.status_code == 409 and "もう友達" in res.json()["detail"]


def test_remove_friend_blocks_conversation_but_keeps_history(client):
    a, b = Person(client, "静子"), Person(client, "花子")
    room = befriend(client, a, b)
    client.post(f"/api/rooms/{room}/messages", json={"content": "こんにちは"}, headers=a.headers)

    assert client.delete(f"/api/friends/{b.id}", headers=a.headers).status_code == 204
    assert client.get("/api/home", headers=b.headers).json()["friends"] == []
    assert client.post(f"/api/rooms/{room}/messages", json={"content": "x"}, headers=b.headers).status_code == 403

    befriend(client, b, a)
    page = client.get(f"/api/rooms/{room}/messages", headers=b.headers).json()
    assert [m["content"] for m in page["items"]] == ["こんにちは"]
