from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import scripts.build_site_data as build_site_data

UA = "OW-Source-Audit/1.0 (+github-actions)"
DEFAULT_TIMEOUT_SECONDS = 20


@dataclass(frozen=True)
class SourceEndpoint:
    service_id: str
    source_id: str
    name: str
    url: str
    role: str
    criticality: str
    collection_error: str | None = None


@dataclass(frozen=True)
class EndpointAuditResult:
    service_id: str
    source_id: str
    name: str
    url: str
    role: str
    criticality: str
    ok: bool
    status_code: int | None
    latency_ms: int | None
    timing_bucket: str
    canonical_url: str | None
    canonical_mismatch: bool
    failure_reason: str | None


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Audit configured source endpoints for live services. "
            "Exits non-zero only for required/official failures by default."
        )
    )
    parser.add_argument(
        "--service",
        action="append",
        default=[],
        help="Limit audit to specific service id(s). Can be repeated.",
    )
    parser.add_argument(
        "--timeout-seconds",
        type=int,
        default=DEFAULT_TIMEOUT_SECONDS,
        help=f"HTTP timeout in seconds (default: {DEFAULT_TIMEOUT_SECONDS}).",
    )
    parser.add_argument(
        "--fail-on-supporting",
        action="store_true",
        help="Also fail (exit 1) when supporting/optional endpoints fail.",
    )
    return parser.parse_args()


def _timing_bucket(latency_ms: int | None) -> str:
    if latency_ms is None:
        return "unknown"
    if latency_ms <= 800:
        return "fast"
    if latency_ms <= 2500:
        return "moderate"
    return "slow"


def _canonical_href(text: str) -> str | None:
    try:
        soup = BeautifulSoup(text, "html.parser")
    except Exception:
        return None
    tag = soup.find("link", rel="canonical")
    if tag is None:
        return None
    href = str(tag.get("href") or "").strip()
    return href or None


def _is_statusgator_canonical_mismatch(url: str, canonical_url: str | None) -> bool:
    lowered_url = str(url or "").strip().lower()
    if "statusgator.com" not in lowered_url:
        return False
    if not canonical_url:
        return False
    normalized = canonical_url.rstrip("/").lower()
    if normalized == "https://statusgator.com":
        return True
    if "/services/" not in normalized:
        return True
    return False


def _is_required_or_official(role: str, criticality: str) -> bool:
    return str(role or "").strip().lower() == "official" or str(criticality or "").strip().lower() == "required"


def _compute_exit_code(results: list[EndpointAuditResult], *, fail_on_supporting: bool = False) -> int:
    required_failures = [
        result
        for result in results
        if not result.ok and _is_required_or_official(result.role, result.criticality)
    ]
    if required_failures:
        return 1
    if fail_on_supporting and any(not result.ok for result in results):
        return 1
    return 0


def _normalize_source_id(raw_source: dict[str, Any], *, default_name: str) -> str:
    source_id = str(raw_source.get("source_id") or "").strip()
    if source_id:
        return source_id
    fallback = default_name.strip().lower().replace(" ", "_")
    return fallback or "unknown_source"


def _load_sources_from_status_file(config: dict[str, Any]) -> list[dict[str, Any]]:
    data_dir = str(config.get("data_dir") or "").strip()
    if not data_dir:
        return []
    status_path = ROOT / data_dir / "status.json"
    if not status_path.exists():
        return []
    try:
        payload = json.loads(status_path.read_text(encoding="utf-8"))
    except Exception:
        return []
    sources = payload.get("sources")
    return sources if isinstance(sources, list) else []


def _collect_service_sources(service_id: str, config: dict[str, Any]) -> list[SourceEndpoint]:
    builder_target = str(config.get("builder") or "").strip()
    kwargs = {
        "force_refresh": True,
        "scoring_profile": config.get("scoring_profile"),
    }
    sources: list[dict[str, Any]] | None = None
    collection_error: str | None = None
    try:
        builder = build_site_data._resolve_builder(builder_target)
        payload = build_site_data._invoke_builder(builder, kwargs)
        source_rows = payload.get("sources") if isinstance(payload, dict) else None
        if isinstance(source_rows, list):
            sources = source_rows
    except Exception as exc:
        collection_error = str(exc)

    if not sources:
        fallback_sources = _load_sources_from_status_file(config)
        if fallback_sources:
            sources = fallback_sources

    if not sources:
        return [
            SourceEndpoint(
                service_id=service_id,
                source_id="builder_collection",
                name="builder_collection",
                url=str(config.get("site_url") or ""),
                role="official",
                criticality="required",
                collection_error=collection_error or "no sources available from builder or status artifact",
            )
        ]

    endpoints: list[SourceEndpoint] = []
    for row in sources:
        if not isinstance(row, dict):
            continue
        name = str(row.get("name") or "unknown source").strip()
        url = str(row.get("url") or "").strip()
        if not url:
            continue
        endpoints.append(
            SourceEndpoint(
                service_id=service_id,
                source_id=_normalize_source_id(row, default_name=name),
                name=name,
                url=url,
                role=str(row.get("role") or "provider").strip().lower() or "provider",
                criticality=str(row.get("criticality") or "supporting").strip().lower() or "supporting",
                collection_error=None,
            )
        )
    if endpoints:
        return endpoints
    return [
        SourceEndpoint(
            service_id=service_id,
            source_id="builder_collection",
            name="builder_collection",
            url=str(config.get("site_url") or ""),
            role="official",
            criticality="required",
            collection_error=collection_error or "no valid endpoint URLs in source rows",
        )
    ]


def _collect_configured_endpoints(services_filter: set[str]) -> list[SourceEndpoint]:
    configs = build_site_data._load_service_configs()
    endpoints: list[SourceEndpoint] = []
    for service_id in sorted(configs.keys()):
        if services_filter and service_id not in services_filter:
            continue
        config = configs[service_id]
        endpoints.extend(_collect_service_sources(service_id, config))
    return endpoints


def _audit_endpoint(endpoint: SourceEndpoint, timeout_seconds: int) -> EndpointAuditResult:
    if endpoint.collection_error:
        return EndpointAuditResult(
            service_id=endpoint.service_id,
            source_id=endpoint.source_id,
            name=endpoint.name,
            url=endpoint.url,
            role=endpoint.role,
            criticality=endpoint.criticality,
            ok=False,
            status_code=None,
            latency_ms=None,
            timing_bucket="unknown",
            canonical_url=None,
            canonical_mismatch=False,
            failure_reason=f"source collection failed: {endpoint.collection_error}",
        )

    started = time.perf_counter()
    try:
        response = requests.get(
            endpoint.url,
            timeout=max(int(timeout_seconds), 1),
            headers={"User-Agent": UA},
            allow_redirects=True,
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        canonical_url = None
        content_type = str(response.headers.get("content-type") or "").lower()
        if "html" in content_type or "statusgator.com" in endpoint.url or "isdown.app" in endpoint.url:
            canonical_url = _canonical_href(response.text)
        canonical_mismatch = _is_statusgator_canonical_mismatch(endpoint.url, canonical_url)
        status_code = int(response.status_code)
        if status_code >= 400:
            return EndpointAuditResult(
                service_id=endpoint.service_id,
                source_id=endpoint.source_id,
                name=endpoint.name,
                url=endpoint.url,
                role=endpoint.role,
                criticality=endpoint.criticality,
                ok=False,
                status_code=status_code,
                latency_ms=latency_ms,
                timing_bucket=_timing_bucket(latency_ms),
                canonical_url=canonical_url,
                canonical_mismatch=canonical_mismatch,
                failure_reason=f"http_{status_code}",
            )
        if canonical_mismatch:
            return EndpointAuditResult(
                service_id=endpoint.service_id,
                source_id=endpoint.source_id,
                name=endpoint.name,
                url=endpoint.url,
                role=endpoint.role,
                criticality=endpoint.criticality,
                ok=False,
                status_code=status_code,
                latency_ms=latency_ms,
                timing_bucket=_timing_bucket(latency_ms),
                canonical_url=canonical_url,
                canonical_mismatch=True,
                failure_reason="canonical_mismatch",
            )
        return EndpointAuditResult(
            service_id=endpoint.service_id,
            source_id=endpoint.source_id,
            name=endpoint.name,
            url=endpoint.url,
            role=endpoint.role,
            criticality=endpoint.criticality,
            ok=True,
            status_code=status_code,
            latency_ms=latency_ms,
            timing_bucket=_timing_bucket(latency_ms),
            canonical_url=canonical_url,
            canonical_mismatch=False,
            failure_reason=None,
        )
    except Exception as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        return EndpointAuditResult(
            service_id=endpoint.service_id,
            source_id=endpoint.source_id,
            name=endpoint.name,
            url=endpoint.url,
            role=endpoint.role,
            criticality=endpoint.criticality,
            ok=False,
            status_code=None,
            latency_ms=latency_ms,
            timing_bucket=_timing_bucket(latency_ms),
            canonical_url=None,
            canonical_mismatch=False,
            failure_reason=f"request_error: {exc}",
        )


def _print_result(result: EndpointAuditResult) -> None:
    required_or_official = _is_required_or_official(result.role, result.criticality)
    if result.ok:
        level = "OK"
    elif required_or_official:
        level = "FAIL"
    else:
        level = "WARN"
    status_label = str(result.status_code) if result.status_code is not None else "-"
    latency_label = f"{result.latency_ms}ms" if result.latency_ms is not None else "-"
    extra = f" reason={result.failure_reason}" if result.failure_reason else ""
    print(
        f"[{level}] {result.service_id}:{result.source_id} role={result.role} criticality={result.criticality} "
        f"http={status_label} latency={latency_label} bucket={result.timing_bucket}{extra}"
    )
    if result.canonical_mismatch:
        print(f"       canonical={result.canonical_url}")


def main() -> int:
    args = _parse_args()
    services_filter = {str(item).strip().lower() for item in (args.service or []) if str(item).strip()}
    endpoints = _collect_configured_endpoints(services_filter)

    if not endpoints:
        print("[audit] no configured source endpoints found.")
        return 1

    results = [_audit_endpoint(endpoint, timeout_seconds=args.timeout_seconds) for endpoint in endpoints]
    for result in results:
        _print_result(result)

    required_failures = [
        result for result in results if (not result.ok) and _is_required_or_official(result.role, result.criticality)
    ]
    supporting_failures = [
        result for result in results if (not result.ok) and not _is_required_or_official(result.role, result.criticality)
    ]

    print(
        "[audit] summary: "
        f"endpoints={len(results)} ok={sum(1 for result in results if result.ok)} "
        f"required_or_official_failures={len(required_failures)} "
        f"supporting_failures={len(supporting_failures)}"
    )

    exit_code = _compute_exit_code(results, fail_on_supporting=bool(args.fail_on_supporting))
    if exit_code != 0:
        print("[audit] FAIL")
    else:
        print("[audit] PASS")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())

