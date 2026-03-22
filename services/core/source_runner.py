from __future__ import annotations

import copy
import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Any, Callable, Generic, Protocol, TypeVar

T = TypeVar("T")
PayloadT = TypeVar("PayloadT")

LOGGER = logging.getLogger("services.core.source_runner")
SOURCE_ROLES = {"official", "provider", "community", "social", "probe"}
SOURCE_CRITICALITIES = {"required", "supporting", "optional"}


@dataclass(frozen=True)
class SourceAdapterSpec:
    service_id: str
    adapter_id: str
    name: str
    kind: str
    url: str
    role: str = "provider"
    criticality: str = "supporting"
    used_for_scoring: bool = True
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
_CACHE_INFLIGHT: dict[str, threading.Event] = {}


def _normalize_source_role(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in SOURCE_ROLES:
        return normalized
    return "provider"


def _normalize_source_criticality(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in SOURCE_CRITICALITIES:
        return normalized
    return "supporting"


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


def _get_or_fetch_cached(key: str, ttl_seconds: int, fetch_fn: Callable[[], T]) -> tuple[bool, T]:
    if ttl_seconds <= 0:
        return False, fetch_fn()

    while True:
        with _CACHE_LOCK:
            entry = _CACHE.get(key)
            if entry:
                stored_at, value = entry
                if (time.time() - stored_at) < ttl_seconds:
                    return True, copy.deepcopy(value)
                _CACHE.pop(key, None)

            inflight = _CACHE_INFLIGHT.get(key)
            if inflight is None:
                inflight = threading.Event()
                _CACHE_INFLIGHT[key] = inflight
                break

        inflight.wait()

    try:
        value = fetch_fn()
    except Exception:
        with _CACHE_LOCK:
            current = _CACHE_INFLIGHT.get(key)
            if current is inflight:
                _CACHE_INFLIGHT.pop(key, None)
                inflight.set()
        raise

    with _CACHE_LOCK:
        _CACHE[key] = (time.time(), copy.deepcopy(value))
        current = _CACHE_INFLIGHT.get(key)
        if current is inflight:
            _CACHE_INFLIGHT.pop(key, None)
            inflight.set()
    return False, copy.deepcopy(value)


def run_parallel_tasks(
    tasks: list[Callable[[], T]],
    *,
    max_workers: int | None = None,
) -> list[T]:
    if not tasks:
        return []
    worker_count = max_workers or len(tasks)
    worker_count = max(1, min(worker_count, len(tasks)))
    if worker_count == 1:
        return [task() for task in tasks]
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        futures = [executor.submit(task) for task in tasks]
        return [future.result() for future in futures]


def build_cached_payload(
    *,
    force_refresh: bool,
    ttl_seconds: int,
    cache_lock: threading.Lock,
    cache_state: dict[str, dict[str, Any]],
    cache_key: str,
    builder: Callable[[], PayloadT],
) -> PayloadT:
    owner_event: threading.Event | None = None
    key = cache_key or "default"

    while True:
        with cache_lock:
            entry = cache_state.setdefault(
                key,
                {
                    "payload": None,
                    "ts": 0.0,
                    "inflight": None,
                },
            )
            cached_payload = entry.get("payload")
            cached_at = float(entry.get("ts") or 0.0)
            inflight = entry.get("inflight")
            if not force_refresh and cached_payload is not None and (time.time() - cached_at) < ttl_seconds:
                return cached_payload
            if inflight is None:
                owner_event = threading.Event()
                entry["inflight"] = owner_event
                break

        if isinstance(inflight, threading.Event):
            inflight.wait()

    try:
        payload = builder()
    except Exception:
        with cache_lock:
            entry = cache_state.get(key)
            if entry and entry.get("inflight") is owner_event:
                entry["inflight"] = None
                owner_event.set()
        raise

    with cache_lock:
        entry = cache_state.setdefault(key, {"payload": None, "ts": 0.0, "inflight": None})
        entry["payload"] = payload
        entry["ts"] = time.time()
        if entry.get("inflight") is owner_event:
            entry["inflight"] = None
            owner_event.set()
        return entry["payload"]


def run_source_adapter(
    adapter: SourceAdapter[T],
    *,
    utc_now_iso: Callable[[], str],
    source_freshness: Callable[[str | None], tuple[str, int | None]],
    safe_error_message: Callable[[Exception], str],
) -> SourceRunResult[T]:
    spec = adapter.spec
    role = _normalize_source_role(spec.role)
    criticality = _normalize_source_criticality(spec.criticality)
    used_for_scoring = bool(spec.used_for_scoring)
    started = time.perf_counter()
    cache_key = f"{spec.service_id}:{spec.adapter_id}"

    cache_hit = False
    data: T | None = None

    try:
        cache_hit, data = _get_or_fetch_cached(cache_key, spec.cache_ttl_seconds, adapter.fetch)

        item_count = adapter.item_count(data) if data is not None else 0
        last_item_at = adapter.last_item_at(data) if data is not None else None
        freshness, age_minutes = source_freshness(last_item_at)
        duration_ms = int((time.perf_counter() - started) * 1000)
        source_entry = {
            "source_id": spec.adapter_id,
            "name": spec.name,
            "kind": spec.kind,
            "url": spec.url,
            "role": role,
            "criticality": criticality,
            "used_for_scoring": used_for_scoring,
            "ok": True,
            "error": None,
            "item_count": item_count if isinstance(item_count, int) else None,
            "last_item_at": last_item_at,
            "freshness": freshness,
            "age_minutes": age_minutes,
            "duration_ms": duration_ms,
            "fetched_at": utc_now_iso(),
            "cache_hit": cache_hit,
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
            "source_id": spec.adapter_id,
            "name": spec.name,
            "kind": spec.kind,
            "url": spec.url,
            "role": role,
            "criticality": criticality,
            "used_for_scoring": used_for_scoring,
            "ok": False,
            "error": error,
            "item_count": 0,
            "last_item_at": None,
            "freshness": "unknown",
            "age_minutes": None,
            "duration_ms": duration_ms,
            "fetched_at": utc_now_iso(),
            "cache_hit": cache_hit,
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
    "build_cached_payload",
    "run_parallel_tasks",
    "run_source_adapter",
]
