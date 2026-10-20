"""WebSocket で届ける相手を管理する。

メモリ上で持っているので、サーバーを複数台にするなら Redis などに置き換える。
"""

import asyncio
import logging
from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from fastapi import WebSocket

log = logging.getLogger(__name__)


class Broadcaster:
    def __init__(self) -> None:
        self._users: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self._users[user_id].add(ws)

    def disconnect(self, user_id: int, ws: WebSocket) -> None:
        conns = self._users.get(user_id)
        if conns is not None:
            conns.discard(ws)
            if not conns:
                del self._users[user_id]

    async def publish_to(self, user_ids: Iterable[int], event: dict[str, Any]) -> None:
        await self._send([(uid, ws) for uid in set(user_ids) for ws in self._users.get(uid, ())], event)

    async def publish_all(self, event: dict[str, Any]) -> None:
        await self._send([(uid, ws) for uid, conns in self._users.items() for ws in conns], event)

    async def _send(self, targets: list[tuple[int, WebSocket]], event: dict[str, Any]) -> None:
        results = await asyncio.gather(*(ws.send_json(event) for _, ws in targets), return_exceptions=True)
        for (uid, ws), res in zip(targets, results):
            if isinstance(res, Exception):
                log.info("dropping dead websocket: %s", res)
                self.disconnect(uid, ws)


_broadcaster = Broadcaster()


def get_broadcaster() -> Broadcaster:
    return _broadcaster
