"""部屋（掲示板・一対一）と連絡。

掲示板は1つだが、見えるのは自分と友達の書き込みだけ。
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import BOARD, DIRECT, Friendship, Message, Room, RoomMember, User
from app.schemas import ConversationSummary, MessageOut, RoomOut, UserOut
from app.services.errors import DomainError, Forbidden, NotFound
from app.services.realtime import Broadcaster


def ensure_board(db: Session) -> Room:
    board = db.scalar(select(Room).where(Room.kind == BOARD))
    if board is None:
        board = Room(kind=BOARD, name=settings.board_name)
        db.add(board)
        db.commit()
    return board


def get_or_create_direct(db: Session, a_id: int, b_id: int) -> Room:
    key = f"{min(a_id, b_id)}:{max(a_id, b_id)}"
    room = db.scalar(select(Room).where(Room.direct_key == key))
    if room is None:
        room = Room(kind=DIRECT, direct_key=key)
        db.add(room)
        db.flush()
        db.add_all([RoomMember(room_id=room.id, user_id=a_id), RoomMember(room_id=room.id, user_id=b_id)])
        db.flush()
    return room


def friend_ids(db: Session, user_id: int) -> list[int]:
    return list(db.scalars(select(Friendship.friend_id).where(Friendship.user_id == user_id)))


def board_authors(db: Session, user_id: int) -> list[int]:
    """掲示板で見える書き込みの書き手（自分＋友達）。"""
    return [user_id, *friend_ids(db, user_id)]


def is_friend(db: Session, user_id: int, other_id: int) -> bool:
    stmt = select(Friendship.id).where(Friendship.user_id == user_id, Friendship.friend_id == other_id)
    return db.scalar(stmt) is not None


def _other_member(db: Session, room: Room, user_id: int) -> User | None:
    ids = list(db.scalars(select(RoomMember.user_id).where(RoomMember.room_id == room.id)))
    if user_id not in ids:
        return None
    other_id = next((i for i in ids if i != user_id), None)
    return db.get(User, other_id) if other_id else None


def get_room_for(db: Session, room_id: int, user: User) -> tuple[Room, User | None]:
    """部屋と相手を返す。一対一の部屋は、2人が友達のあいだだけ入れる。"""
    room = db.get(Room, room_id)
    if room is None:
        raise NotFound("このやり取りは見つかりませんでした")
    if room.kind == BOARD:
        return room, None
    friend = _other_member(db, room, user.id)
    if friend is None:
        raise NotFound("このやり取りは見つかりませんでした")
    if not is_friend(db, user.id, friend.id):
        raise Forbidden(f"{friend.username}さんは友達ではないため、連絡できません")
    return room, friend


def room_view(db: Session, room_id: int, user: User) -> RoomOut:
    room, friend = get_room_for(db, room_id, user)
    if friend is None:
        return RoomOut(id=room.id, kind=BOARD, title=room.name or settings.board_name)
    return RoomOut(id=room.id, kind=DIRECT, title=friend.username, friend=UserOut.model_validate(friend))


def list_messages(db: Session, room_id: int, user: User, limit: int, before_id: int | None) -> tuple[list[Message], bool]:
    """新しい順に limit 件取り、古い順に並べて返す。
    OFFSET ではなく id で区切るので、新着が増えてもずれない。"""
    room, _ = get_room_for(db, room_id, user)
    stmt = select(Message).where(Message.room_id == room_id)
    if room.kind == BOARD:
        stmt = stmt.where(Message.user_id.in_(board_authors(db, user.id)))
    if before_id is not None:
        stmt = stmt.where(Message.id < before_id)
    rows = list(db.scalars(stmt.order_by(Message.id.desc()).limit(limit + 1)))
    has_more = len(rows) > limit
    return list(reversed(rows[:limit])), has_more


async def send_message(
    db: Session, broadcaster: Broadcaster, room_id: int, user: User, content: str, mention_user_id: int | None = None
) -> Message:
    room, friend = get_room_for(db, room_id, user)
    if mention_user_id is not None:
        if room.kind != BOARD:
            raise DomainError("宛先は掲示板でだけ選べます")
        if not is_friend(db, user.id, mention_user_id):
            raise DomainError("宛先には友達だけを選べます")
    msg = Message(room_id=room.id, user_id=user.id, content=content, mention_user_id=mention_user_id)
    db.add(msg)
    db.flush()
    # 自分の書き込みは既読にしておく
    _membership(db, room.id, user.id).last_read_message_id = msg.id
    db.commit()
    db.refresh(msg)

    event = {"type": "message.created", "data": MessageOut.model_validate(msg).model_dump(mode="json")}
    if friend is None:  # 掲示板は書いた人とその友達だけに送る
        await broadcaster.publish_to(board_authors(db, user.id), event)
    else:
        await broadcaster.publish_to([user.id, friend.id], event)
    return msg


def _latest_message_id(db: Session, room_id: int) -> int:
    return db.scalar(select(func.max(Message.id)).where(Message.room_id == room_id)) or 0


def _membership(db: Session, room_id: int, user_id: int) -> RoomMember:
    """参加の記録がなければ「全部読んだ」状態で作る（古いお知らせが未読で並ばないように）。"""
    m = db.scalar(select(RoomMember).where(RoomMember.room_id == room_id, RoomMember.user_id == user_id))
    if m is None:
        m = RoomMember(room_id=room_id, user_id=user_id, last_read_message_id=_latest_message_id(db, room_id))
        db.add(m)
        db.flush()
    return m


def join_board(db: Session, user_id: int) -> None:
    """登録時に呼ぶ。これ以降の掲示板の書き込みが未読として数えられる。"""
    _membership(db, ensure_board(db).id, user_id)


def mark_read(db: Session, room_id: int, user: User) -> None:
    room, _ = get_room_for(db, room_id, user)
    _membership(db, room.id, user.id).last_read_message_id = _latest_message_id(db, room.id)
    db.commit()


def summarize(db: Session, room_id: int, user_id: int, authors: list[int] | None = None) -> ConversationSummary:
    """未読数・自分宛ての未読数・最後の連絡。authors を渡すとその人の書き込みだけ数える。"""
    last_read = _membership(db, room_id, user_id).last_read_message_id
    visible = [Message.room_id == room_id]
    if authors is not None:
        visible.append(Message.user_id.in_(authors))
    unread_cond = [*visible, Message.id > last_read, Message.user_id != user_id]

    unread = db.scalar(select(func.count(Message.id)).where(*unread_cond))
    mentions = db.scalar(select(func.count(Message.id)).where(*unread_cond, Message.mention_user_id == user_id))
    last = db.scalar(select(Message).where(*visible).order_by(Message.id.desc()).limit(1))
    return ConversationSummary(
        room_id=room_id,
        unread=unread or 0,
        mentions=mentions or 0,
        last_message=MessageOut.model_validate(last) if last else None,
    )
