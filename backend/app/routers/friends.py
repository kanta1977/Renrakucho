from fastapi import APIRouter, status
from pydantic import ValidationError

from app.deps import DB, BroadcasterDep, CurrentUser
from app.schemas import FriendAdd, HomeOut, UserOut
from app.services import friends as friends_service
from app.services.errors import DomainError

router = APIRouter(tags=["friends"])


@router.get("/home", response_model=HomeOut)
def home(db: DB, user: CurrentUser):
    """はじめの画面に必要なもの（掲示板・友達・未読数）をまとめて返す。"""
    return friends_service.home(db, user)


@router.get("/users/by-code/{friend_code}", response_model=UserOut)
def lookup(friend_code: str, db: DB, user: CurrentUser):
    """番号の持ち主を返す（追加する前の確認用）。"""
    try:
        code = FriendAdd(friend_code=friend_code).friend_code
    except ValidationError:
        raise DomainError("番号は6けたの数字で入れてください") from None
    return friends_service.lookup(db, user, code)


@router.post("/friends", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def add_friend(body: FriendAdd, db: DB, user: CurrentUser, broadcaster: BroadcasterDep):
    return await friends_service.add_friend(db, broadcaster, user, body.friend_code)


@router.delete("/friends/{friend_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_friend(friend_id: int, db: DB, user: CurrentUser, broadcaster: BroadcasterDep):
    await friends_service.remove_friend(db, broadcaster, user, friend_id)
