"""Minute buckets and observed power time; never extrapolate across outages."""

from datetime import datetime, timedelta
from itertools import pairwise
from statistics import mean

from sqlalchemy.orm import Session as OrmSession

from .db import Measurement
from .types import JsonObject


class Measurements:
    def __init__(self) -> None:
        self.samples: list[tuple[datetime, JsonObject]] = []
        self.minute: datetime | None = None
        self.observed_power: dict[datetime, float] = {}

    def observe_power(
        self, previous: JsonObject | None, previous_at: datetime | None, now: datetime, failures: int
    ) -> None:
        if previous and previous["power"] and previous_at and not failures:
            cursor = previous_at
            end = min(now, previous_at + timedelta(seconds=10))
            while cursor < end:
                bucket = cursor.replace(second=0, microsecond=0)
                boundary = min(end, bucket + timedelta(minutes=1))
                self.observed_power[bucket] = (
                    self.observed_power.get(bucket, 0) + (boundary - cursor).total_seconds()
                )
                cursor = boundary

    def aggregate(self, session: OrmSession, values: JsonObject, now: datetime) -> None:
        minute = now.replace(second=0, microsecond=0)
        if self.minute != minute:
            if self.samples:
                self.flush_samples(session)
            self.minute = minute
            self.samples = []
        self.samples.append((now, dict(values)))

    def flush_samples(self, session: OrmSession) -> None:
        if not self.samples or self.minute is None:
            return
        samples = self.samples
        humidity_values = [values["humidity"] for _, values in samples]
        temperature_values = [values["temperature"] for _, values in samples]
        # Observed seconds only: cap gaps at the normal polling cadence.
        seconds = self.observed_power.pop(self.minute, None)
        if seconds is None:
            seconds = sum(
                min(10, (b[0] - a[0]).total_seconds()) * bool(a[1]["power"]) for a, b in pairwise(samples)
            )
        session.merge(
            Measurement(
                at=self.minute,
                count=len(samples),
                humidity=mean(humidity_values),
                temperature=mean(temperature_values),
                humidity_min=min(humidity_values),
                humidity_max=max(humidity_values),
                temperature_min=min(temperature_values),
                temperature_max=max(temperature_values),
                target_humidity=mean(v["target_humidity"] for _, v in samples),
                speed=mean(v["speed"] for _, v in samples),
                power_seconds=seconds,
                status=samples[-1][1]["status"],
            )
        )
