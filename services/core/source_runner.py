from __future__ import annotations

import copy
import logging
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Generic, Protocol, TypeVar

T = TypeVar("T")

LOGGER = logging.getLogger("services.core.source_runner")


@dataclass(frozen=True)
class SourceAdapterSpec:
    service_id: str
    adapter_id: str
    name: str
    kind: str
    url: str
    cache_ttl_seconds: int = 0


class SourceAdapter(Protocol[T]):
    spec: SourceAdapterSpec

    def fetch(self) -> T: ...

    def item_count(self, data: T) -> int | None: ...

    def last_item_at(self, data: T) -> str | None: ...


@dataclass(frozen=True)
class CallableSourceAdapter(Generic[T]):
    spec: SourceAdapterSpec
    fetch_fn: Callable[[], T]
    item_count_fn: Callable[[T], int | None]
    last_item_at_fn: Callable[[T], str | None]

    def fetch(self) -> T:
        return self.fetch_fn()

    def item_count(self, data: T) -> int | None:
        return self.item_count_fn(data)

    def last_item_at(self, data: T) -> str | None:
        return self.last_item_at_fn(data)


@dataclass(frozen=True)
class SourceRunResult(Generic[T]):
    ok: bool
    data: T | None
    source: dict[str, Any]
    cache_hit: bool = False
    error: str | None = None


_CACHE_LOCK = threading.Lock()
_CACHE: dict[str, tuple[float, Any]] = {}


def _cache_get(key: str, ttl_seconds: int) -> tuple[bool, Any]:
    if ttl_seconds <= 0:
        return False, None
    now = time.time()
    with _CACHE_LOCK:
        entry = _CACHE.get(key)
        if not entry:
            return False, None
        stored_at, value = entry
        if (now - stored_at) >= ttl_seconds:
            _CACHE.pop(key, None)
            return False, None
        return True, copy.deepcopy(value)


def _cache_set(key: str, value: Any) -> None:
    with _CACHE_LOCK:
        _CACHE[key] = (time.time(), copy.deepcopy(value))


def run_source_adapter(
    adapter: SourceAdapter[T],
    *,
    utc_now_iso: Callable[[], str],
    source_freshness: Callable[[str | None], tuple[str, int | None]],
    safe_error_message: Callable[[Exception], str],
) -> SourceRunResult[T]:
    spec = adapter.spec
    started = time.perf_counter()
    cache_key = f"{spec.service_id}:{spec.adapter_id}"

    cache_hit = False
    data: T | None = None
    if spec.cache_ttl_seconds > 0:
        cache_hit, cached_value = _cache_get(cache_key, spec.cache_ttl_seconds)
        if cache_hit:
            data = cached_value

    try:
        if not cache_hit:
            data = adapter.fetch()
            if spec.cache_ttl_seconds > 0:
                _cache_set(cache_key, data)

        item_count = adapter.item_count(data) if data is not None else 0
        last_item_at = adapter.last_item_at(data) if data is not None else None
        freshness, age_minutes = source_freshness(last_item_at)
        duration_ms = int((time.perf_counter() - started) * 1000)
        source_entry = {
            "name": spec.name,
            "kind": spec.kind,
            "url": spec.url,
            "ok": True,
            "error": None,
            "item_count": item_count if isinstance(item_count, int) else None,
            "last_item_at": last_item_at,
            "freshness": freshness,
            "age_minutes": age_minutes,
            "duration_ms": duration_ms,
            "fetched_at": utc_now_iso(),
        }
        LOGGER.info(
            "source_run service=%s adapter=%s ok=true cache_hit=%s duration_ms=%s items=%s freshness=%s",
            spec.service_id,
            spec.adapter_id,
            str(cache_hit).lower(),
            duration_ms,
            item_count if item_count is not None else "null",
            freshness,
        )
        return SourceRunResult(ok=True, data=data, source=source_entry, cache_hit=cache_hit, error=None)
    except Exception as exc:  # pragma: no cover
        duration_ms = int((time.perf_counter() - started) * 1000)
        error = safe_error_message(exc)
        source_entry = {
            "name": spec.name,
            "kind": spec.kind,
            "url": spec.url,
            "ok": False,
            "error": error,
            "item_count": 0,
            "last_item_at": None,
            "freshness": "unknown",
            "age_minutes": None,
            "duration_ms": duration_ms,
            "fetched_at": utc_now_iso(),
        }
        LOGGER.warning(
            "source_run service=%s adapter=%s ok=false cache_hit=%s duration_ms=%s error=%s",
            spec.service_id,
            spec.adapter_id,
            str(cache_hit).lower(),
            duration_ms,
            error,
        )
        return SourceRunResult(ok=False, data=None, source=source_entry, cache_hit=cache_hit, error=error)


__all__ = [
    "CallableSourceAdapter",
    "SourceAdapter",
    "SourceAdapterSpec",
    "SourceRunResult",
    "run_source_adapter",
]
