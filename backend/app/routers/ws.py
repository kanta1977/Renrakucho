"""WebSocket（受信専用）。送信は REST で行う。

ブラウザの WebSocket はヘッダーを付けられないので、トークンはクエリで受け取る。
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.database import SessionLocal
from app.services import auth as auth_service
from app.services.errors import DomainError
from app.services.realtime import get_broadcaster

router = APIRouter()


@router.websocket("/ws")
async def user_socket(ws: WebSocket, token: str | None = None):
    # 接続中ずっと DB をつかまないよう、認証が終わったらすぐ閉じる
    with SessionLocal() as db:
        try:
            user_id = auth_service.authenticate(db, token).id
        except DomainError as e:
            await ws.close(code=status.WS_1008_POLICY_VIOLATION, reason=e.message)
            return

    broadcaster = get_broadcaster()
    await broadcaster.connect(user_id, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        broadcaster.disconnect(user_id, ws)
