from __future__ import annotations

import unittest

import services.x_aggregator as x_aggregator


STATUS_HTML = """
<html>
  <body>
    <h1>X Developer Platform Status</h1>
    <div><span>Some systems are experiencing degraded performance.</span></div>
    <h2>X API v2</h2>
    <div>Degraded</div>
    <h2>GNIP Enterprise API</h2>
    <div>Normal</div>
    <h2>Developer Console</h2>
    <div>Normal</div>
  </body>
</html>
"""


INCIDENTS_HTML = """
<html>
  <body>
    <h1>Incident History</h1>
    <h2>\u200b March 2026</h2>
    <div class="steps ml-3.5 mt-10 mb-6">
      <div class="step group/step step-container relative flex items-start pb-5">
        <div class="w-full overflow-hidden pl-8 pr-px">
          <p class="mt-2 font-semibold prose dark:prose-invert text-gray-900 dark:text-gray-200">
            Increased Webhook latency
          </p>
          <div class="prose dark:prose-invert">
            <span>Incident has been resolved. | <strong>March 24, 15:20:00 UTC - 18:00:00 UTC</strong></span>
          </div>
        </div>
      </div>
      <div class="step group/step step-container relative flex items-start pb-5">
        <div class="w-full overflow-hidden pl-8 pr-px">
          <p class="mt-2 font-semibold prose dark:prose-invert text-gray-900 dark:text-gray-200">
            API endpoint degredation
          </p>
          <div class="prose dark:prose-invert">
            <span>Incident is ongoing. | <strong>March 24, 02:00 UTC - Current</strong></span>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
"""


class XOfficialParsingTests(unittest.TestCase):
    def test_parse_component_snapshot_extracts_components(self) -> None:
        payload = x_aggregator._parse_component_snapshot(STATUS_HTML, checked_at="2026-03-24T18:00:00Z")

        self.assertEqual(payload.get("current_status"), "degraded")
        self.assertEqual(payload.get("description"), "Some systems are experiencing degraded performance.")
        self.assertEqual(len(payload.get("components") or []), 3)
        self.assertEqual((payload.get("components") or [])[0].get("name"), "X API v2")
        self.assertEqual((payload.get("components") or [])[0].get("status"), "degraded")
        self.assertEqual(payload.get("top_component_issues"), [{"label": "X API v2", "count": 1}])

    def test_parse_incident_history_extracts_resolved_and_active_incidents(self) -> None:
        payload = x_aggregator._parse_incident_history(INCIDENTS_HTML)

        incidents = payload.get("incidents") or []
        active_incidents = payload.get("active_incidents") or []
        updates = payload.get("updates") or []

        self.assertEqual(len(incidents), 2)
        self.assertEqual(len(active_incidents), 1)
        self.assertEqual(active_incidents[0].get("title"), "API endpoint degredation")
        self.assertEqual(active_incidents[0].get("started_at"), "2026-03-24T02:00:00Z")
        self.assertEqual(len(updates), 2)
        self.assertEqual(updates[0].get("title"), "Increased Webhook latency")


if __name__ == "__main__":
    unittest.main()
