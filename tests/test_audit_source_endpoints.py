from __future__ import annotations

import unittest

import scripts.audit_source_endpoints as audit_source_endpoints


def _result(*, ok: bool, role: str, criticality: str, failure_reason: str | None = None):
    return audit_source_endpoints.EndpointAuditResult(
        service_id="test",
        source_id="source",
        name="Source",
        url="https://example.test",
        role=role,
        criticality=criticality,
        ok=ok,
        status_code=200 if ok else 503,
        latency_ms=100,
        timing_bucket="fast",
        canonical_url=None,
        canonical_mismatch=False,
        failure_reason=failure_reason,
    )


class SourceAuditTests(unittest.TestCase):
    def test_statusgator_canonical_mismatch_detects_root_redirect(self) -> None:
        self.assertTrue(
            audit_source_endpoints._is_statusgator_canonical_mismatch(
                "https://statusgator.com/services/steam",
                "https://statusgator.com/",
            )
        )
        self.assertFalse(
            audit_source_endpoints._is_statusgator_canonical_mismatch(
                "https://statusgator.com/services/openai",
                "https://statusgator.com/services/openai",
            )
        )

    def test_compute_exit_code_required_failure_is_fatal(self) -> None:
        results = [
            _result(ok=True, role="provider", criticality="supporting"),
            _result(ok=False, role="official", criticality="required", failure_reason="http_503"),
        ]
        self.assertEqual(audit_source_endpoints._compute_exit_code(results), 1)

    def test_compute_exit_code_supporting_failure_not_fatal_by_default(self) -> None:
        results = [
            _result(ok=True, role="official", criticality="required"),
            _result(ok=False, role="provider", criticality="supporting", failure_reason="http_503"),
        ]
        self.assertEqual(audit_source_endpoints._compute_exit_code(results), 0)

    def test_compute_exit_code_supporting_failure_can_be_strict(self) -> None:
        results = [
            _result(ok=True, role="official", criticality="required"),
            _result(ok=False, role="provider", criticality="supporting", failure_reason="http_503"),
        ]
        self.assertEqual(audit_source_endpoints._compute_exit_code(results, fail_on_supporting=True), 1)


if __name__ == "__main__":
    unittest.main()

