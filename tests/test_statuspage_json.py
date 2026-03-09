from __future__ import annotations

import unittest

from services.adapters.statuspage_json import parse_statuspage_official_payloads


class StatuspageJsonAdapterTests(unittest.TestCase):
    def test_parse_statuspage_official_payloads_extracts_relevant_scheduled_maintenances(self) -> None:
        payload = parse_statuspage_official_payloads(
            status_payload={
                "status": {
                    "indicator": "minor",
                    "description": "Partial service disruption",
                }
            },
            components_payload={"components": []},
            incidents_payload={
                "incidents": [
                    {
                        "id": "maint-future",
                        "name": "Planned API maintenance",
                        "impact": "maintenance",
                        "status": "scheduled",
                        "created_at": "2099-03-10T00:00:00Z",
                        "updated_at": "2099-03-10T00:10:00Z",
                        "scheduled_for": "2099-03-11T02:00:00Z",
                        "scheduled_until": "2099-03-11T03:30:00Z",
                        "incident_updates": [
                            {
                                "id": "maint-update-1",
                                "status": "scheduled",
                                "body": "Maintenance window for API database upgrades.",
                                "display_at": "2099-03-10T00:10:00Z",
                            }
                        ],
                    },
                    {
                        "id": "maint-resolved",
                        "name": "Resolved maintenance",
                        "impact": "maintenance",
                        "status": "completed",
                        "created_at": "2025-03-01T00:00:00Z",
                        "updated_at": "2025-03-01T00:15:00Z",
                        "scheduled_for": "2025-03-01T01:00:00Z",
                        "scheduled_until": "2025-03-01T02:00:00Z",
                    },
                    {
                        "id": "incident-1",
                        "name": "Login issue",
                        "impact": "minor",
                        "status": "investigating",
                        "created_at": "2099-03-10T04:00:00Z",
                        "updated_at": "2099-03-10T04:10:00Z",
                        "incident_updates": [
                            {
                                "id": "incident-update-1",
                                "status": "investigating",
                                "body": "We are investigating elevated login failures.",
                                "display_at": "2099-03-10T04:10:00Z",
                            }
                        ],
                    },
                ]
            },
            page_url="https://status.example.com",
            source_name="Example Statuspage",
            checked_at="2099-03-10T04:15:00Z",
        )

        scheduled = payload.get("scheduled_maintenances") or []
        self.assertEqual(len(scheduled), 1)
        self.assertEqual(scheduled[0]["title"], "Planned API maintenance")
        self.assertEqual(scheduled[0]["starts_at"], "2099-03-11T02:00:00Z")
        self.assertEqual(scheduled[0]["ends_at"], "2099-03-11T03:30:00Z")
        self.assertEqual(scheduled[0]["status"], "Scheduled")
        self.assertEqual(scheduled[0]["summary"], "Maintenance window for API database upgrades.")
        self.assertEqual(scheduled[0]["url"], "https://status.example.com/incidents/maint-future")

        incidents = payload.get("incidents") or []
        self.assertEqual(len(incidents), 3)
        self.assertEqual(incidents[0]["title"], "Login issue")


if __name__ == "__main__":
    unittest.main()
