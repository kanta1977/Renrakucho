from typing import Annotated

from fastapi import APIRouter, Query, status

from app.config import settings
from app.deps import DB, BroadcasterDep, CurrentUser
from app.schemas import MessageCreate, MessageOut, MessagePage, RoomOut
from app.services import chat as chat_service

router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.get("/{room_id}", response_model=RoomOut)
def get_room(room_id: int, db: DB, user: CurrentUser):
    return chat_service.room_view(db, room_id, user)


@router.get("/{room_id}/messages", response_model=MessagePage)
def list_messages(
    room_id: int,
    db: DB,
    user: CurrentUser,
    limit: Annotated[int, Query(ge=1, le=settings.page_size_max)] = 30,
    before_id: Annotated[int | None, Query(ge=1, description="Return messages older than this id")] = None,
):
    items, has_more = chat_service.list_messages(db, room_id, user, limit, before_id)
    return MessagePage(items=[MessageOut.model_validate(m) for m in items], has_more=has_more)


@router.post("/{room_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(room_id: int, body: MessageCreate, db: DB, user: CurrentUser, broadcaster: BroadcasterDep):
    return await chat_service.send_message(db, broadcaster, room_id, user, body.content, body.mention_user_id)


@router.post("/{room_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_read(room_id: int, db: DB, user: CurrentUser):
    chat_service.mark_read(db, room_id, user)
