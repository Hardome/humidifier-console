"""Telegram transport and durable at-most-once delivery."""

import asyncio
import os
from collections.abc import Awaitable, Callable

import httpx
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from .db import Delivery, Event, utcnow


class Notifications:
    def __init__(self, sessions: sessionmaker[Session]) -> None:
        self.sessions = sessions

    async def deliver(self, send: Callable[[str], Awaitable[None]]) -> bool:
        try:
            pending = await asyncio.to_thread(self.claim)
            if pending is None:
                return True
            delivery_id, message = pending
            try:
                await send(message)
                status = "sent"
            except Exception:
                status = "unknown"
            await asyncio.to_thread(self.complete, delivery_id, status)
        except SQLAlchemyError:
            return False

        return True

    def claim(self) -> tuple[str, str] | None:
        with self.sessions.begin() as session:
            row = session.scalar(
                select(Delivery)
                .where(Delivery.status == "pending", Delivery.next_attempt <= utcnow())
                .order_by(Delivery.at)
                .limit(1)
            )
            if row is None:
                return None
            event = session.get(Event, row.event_id)
            if event is None:
                row.status = "unknown"
                return None
            # Commit intent before sending; an ambiguous result is never retried.
            row.status = "sending"
            return row.id, event.message

    def complete(self, delivery_id: str, status: str) -> None:
        with self.sessions.begin() as session:
            row = session.get(Delivery, delivery_id)
            if row is not None:
                row.status = status
                row.attempts += 1


async def send_telegram(message: str) -> None:
    token, chat = os.getenv("TELEGRAM_BOT_TOKEN"), os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat:
        raise ValueError("telegram_not_configured")
    async with httpx.AsyncClient(timeout=8, trust_env=False) as client:
        response = await client.post(
            f"https://api.telegram.org/bot{token}/sendMessage", json={"chat_id": chat, "text": message}
        )
        if response.status_code != 200 or not response.json().get("ok"):
            raise ValueError("telegram_delivery")
