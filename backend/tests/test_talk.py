import pytest
from starlette.websockets import WebSocketDisconnect

from tests.conftest import Person, befriend


def make_friends(client):
    a, b = Person(client, "静子"), Person(client, "花子")
    return a, b, befriend(client, a, b)


def board_id(client, person):
    return client.get("/api/home", headers=person.headers).json()["board"]["room_id"]


def test_direct_message_and_unread_count(client):
    a, b, room = make_friends(client)
    client.post(f"/api/rooms/{room}/messages", json={"content": "元気？"}, headers=a.headers)
    client.post(f"/api/rooms/{room}/messages", json={"content": "今度お茶でも"}, headers=a.headers)

    friend = client.get("/api/home", headers=b.headers).json()["friends"][0]
    assert friend["unread"] == 2
    assert friend["last_message"]["content"] == "今度お茶でも"
    assert client.get("/api/home", headers=a.headers).json()["friends"][0]["unread"] == 0

    assert client.post(f"/api/rooms/{room}/read", headers=b.headers).status_code == 204
    assert client.get("/api/home", headers=b.headers).json()["friends"][0]["unread"] == 0


def test_room_view_titles(client):
    a, _, room = make_friends(client)
    assert client.get(f"/api/rooms/{room}", headers=a.headers).json() | {"friend": None} == {
        "id": room, "kind": "direct", "title": "花子", "friend": None
    }
    board = client.get(f"/api/rooms/{board_id(client, a)}", headers=a.headers).json()
    assert board["kind"] == "board" and board["title"] == "友達の掲示板"


def test_strangers_cannot_read_direct_room(client):
    _, _, room = make_friends(client)
    stranger = Person(client, "知らない人")
    assert client.get(f"/api/rooms/{room}/messages", headers=stranger.headers).status_code == 404


def test_board_shows_only_self_and_friends(client):
    a, b, _ = make_friends(client)
    stranger = Person(client, "知らない人")
    board = board_id(client, a)
    client.post(f"/api/rooms/{board}/messages", json={"content": "静子です"}, headers=a.headers)
    client.post(f"/api/rooms/{board}/messages", json={"content": "知らない人です"}, headers=stranger.headers)

    def contents(p):
        return [m["content"] for m in client.get(f"/api/rooms/{board}/messages", headers=p.headers).json()["items"]]

    assert contents(a) == ["静子です"]
    assert contents(b) == ["静子です"]
    assert contents(stranger) == ["知らない人です"]
    assert client.get("/api/home", headers=b.headers).json()["board"]["unread"] == 1
    assert client.get("/api/home", headers=stranger.headers).json()["board"]["unread"] == 0


def test_board_mention(client):
    a, b, _ = make_friends(client)
    stranger = Person(client, "知らない人")
    board = board_id(client, a)
    res = client.post(f"/api/rooms/{board}/messages", json={"content": "花子さん、明日ね", "mention_user_id": b.id},
                      headers=a.headers)
    assert res.status_code == 201
    assert res.json()["mention"] == {"id": b.id, "username": "花子"}
    assert client.get("/api/home", headers=b.headers).json()["board"]["mentions"] == 1

    bad = client.post(f"/api/rooms/{board}/messages", json={"content": "x", "mention_user_id": stranger.id},
                      headers=a.headers)
    assert bad.status_code == 400
    dm = client.get("/api/home", headers=a.headers).json()["friends"][0]["room_id"]
    assert client.post(f"/api/rooms/{dm}/messages", json={"content": "x", "mention_user_id": b.id},
                       headers=a.headers).status_code == 400


def test_new_users_start_with_board_read(client):
    a = Person(client, "静子")
    board = board_id(client, a)
    client.post(f"/api/rooms/{board}/messages", json={"content": "来週は書道教室お休みです"}, headers=a.headers)
    b = Person(client, "花子")
    assert client.get("/api/home", headers=b.headers).json()["board"]["unread"] == 0


def test_validation_and_pagination(client):
    a, _, room = make_friends(client)
    assert client.post(f"/api/rooms/{room}/messages", json={"content": "  "}, headers=a.headers).status_code == 422
    for i in range(5):
        client.post(f"/api/rooms/{room}/messages", json={"content": f"m{i}"}, headers=a.headers)
    first = client.get(f"/api/rooms/{room}/messages?limit=2", headers=a.headers).json()
    assert [m["content"] for m in first["items"]] == ["m3", "m4"] and first["has_more"]
    rest = client.get(f"/api/rooms/{room}/messages?before_id={first['items'][0]['id']}", headers=a.headers).json()
    assert [m["content"] for m in rest["items"]] == ["m0", "m1", "m2"] and not rest["has_more"]


def test_websocket_routes_events_to_the_right_people(client):
    a, b, room = make_friends(client)
    stranger = Person(client, "知らない人")
    with client.websocket_connect(f"/ws?token={b.token}") as ws_b, \
         client.websocket_connect(f"/ws?token={stranger.token}") as ws_s:
        client.post(f"/api/rooms/{room}/messages", json={"content": "内緒の話"}, headers=a.headers)
        ev = ws_b.receive_json()
        assert ev["type"] == "message.created" and ev["data"]["content"] == "内緒の話"

        client.post(f"/api/rooms/{board_id(client, a)}/messages", json={"content": "お知らせ"}, headers=a.headers)
        assert ws_b.receive_json()["data"]["content"] == "お知らせ"
        client.post(f"/api/rooms/{board_id(client, stranger)}/messages", json={"content": "ひとりごと"},
                    headers=stranger.headers)
        assert ws_s.receive_json()["data"]["content"] == "ひとりごと"


def test_websocket_notifies_friend_changes(client):
    a, b = Person(client, "静子"), Person(client, "花子")
    with client.websocket_connect(f"/ws?token={b.token}") as ws:
        client.post("/api/friends", json={"friend_code": b.code}, headers=a.headers)
        assert ws.receive_json() == {"type": "friends.changed"}


def test_websocket_rejects_bad_token(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws?token=bad") as ws:
            ws.receive_json()
