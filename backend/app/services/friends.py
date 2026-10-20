"""友達と、はじめの画面。

申請・承認はなし。番号を入れて確認したら、お互いが友達になる。
"""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Friendship, User
from app.schemas import FriendOut, HomeOut, MeOut, UserOut
from app.services import auth, chat
from app.services.errors import Conflict, DomainError, NotFound
from app.services.realtime import Broadcaster

FRIENDS_CHANGED = {"type": "friends.changed"}


def home(db: Session, user: User) -> HomeOut:
    board = chat.ensure_board(db)
    board_summary = chat.summarize(db, board.id, user.id, authors=chat.board_authors(db, user.id))
    friendships = db.scalars(select(Friendship).where(Friendship.user_id == user.id))
    friends = []
    for f in friendships:
        room = chat.get_or_create_direct(db, user.id, f.friend_id)
        summary = chat.summarize(db, room.id, user.id)
        friends.append(
            FriendOut(**summary.model_dump(), user=UserOut.model_validate(f.friend), since=f.created_at)
        )
    db.commit()

    # 未読あり → 最近やり取りした順 → 名前順
    friends.sort(
        key=lambda x: (x.unread == 0, -(x.last_message.id if x.last_message else 0), x.user.username)
    )
    return HomeOut(me=MeOut.model_validate(user), board=board_summary, friends=friends)


def lookup(db: Session, user: User, friend_code: str) -> User:
    """番号の持ち主を探す（追加前の確認用）。"""
    friend = auth.find_by_code(db, friend_code)
    if friend.id == user.id:
        raise DomainError("これはあなたご自身の番号です")
    return friend


async def add_friend(db: Session, broadcaster: Broadcaster, user: User, friend_code: str) -> User:
    friend = lookup(db, user, friend_code)
    if chat.is_friend(db, user.id, friend.id):
        raise Conflict(f"{friend.username}さんは、もう友達です")

    db.add(Friendship(user_id=user.id, friend_id=friend.id))
    if not chat.is_friend(db, friend.id, user.id):
        db.add(Friendship(user_id=friend.id, friend_id=user.id))
    chat.get_or_create_direct(db, user.id, friend.id)
    db.commit()
    await broadcaster.publish_to([friend.id], FRIENDS_CHANGED)
    return friend


async def remove_friend(db: Session, broadcaster: Broadcaster, user: User, friend_id: int) -> None:
    """お互いの友達関係を消す。やり取りの記録は残す。"""
    if not chat.is_friend(db, user.id, friend_id):
        raise NotFound("この方は友達ではありません")
    db.execute(
        delete(Friendship).where(
            ((Friendship.user_id == user.id) & (Friendship.friend_id == friend_id))
            | ((Friendship.user_id == friend_id) & (Friendship.friend_id == user.id))
        )
    )
    db.commit()
    await broadcaster.publish_to([friend_id], FRIENDS_CHANGED)
