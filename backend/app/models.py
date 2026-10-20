"""テーブル定義。

rooms.kind は "board"（掲示板。1つだけ）と "direct"（友達との一対一）の2種類。
"""

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

BOARD = "board"
DIRECT = "direct"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    # 表示用の名前。同じ名前の人がいてもよい
    username: Mapped[str] = mapped_column(String(50))
    # お友達番号（例: 482915）。本人を見分けるのはこちら
    friend_code: Mapped[str] = mapped_column(String(12), unique=True, index=True)
    # パスワードそのものではなく、ハッシュ化したものを保存する
    password_hash: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuthToken(Base):
    """ログイン中であることを示すトークン。有効期限などを後から足せるよう users と分けている。"""

    __tablename__ = "auth_tokens"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship()


class Friendship(Base):
    """友達関係。追加すると (自分→相手) と (相手→自分) の2行を作る。"""

    __tablename__ = "friendships"
    __table_args__ = (UniqueConstraint("user_id", "friend_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    friend_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    friend: Mapped[User] = relationship(foreign_keys=[friend_id])


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(10))
    name: Mapped[str | None] = mapped_column(String(50))
    # 一対一の部屋だけ使う。"小さいID:大きいID" で、同じ2人の部屋が重複しないようにする
    direct_key: Mapped[str | None] = mapped_column(String(40), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RoomMember(Base):
    """部屋の参加者と、どこまで読んだか（未読数の計算に使う）。"""

    __tablename__ = "room_members"
    __table_args__ = (UniqueConstraint("room_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    last_read_message_id: Mapped[int] = mapped_column(default=0)


class Message(Base):
    __tablename__ = "messages"
    # 部屋ごとに id 順で取り出すことが多いので索引を張る
    __table_args__ = (Index("ix_messages_room_id_id", "room_id", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    content: Mapped[str] = mapped_column(Text)
    # 掲示板の宛先。宛先を付けても、書いた人の友達全員から見える
    mention_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(foreign_keys=[user_id], lazy="joined")
    mention: Mapped[User | None] = relationship(foreign_keys=[mention_user_id], lazy="joined")
