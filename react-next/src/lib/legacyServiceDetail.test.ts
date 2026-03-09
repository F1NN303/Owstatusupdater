import { describe, expect, it } from "vitest";

import {
  sanitizeLegacyHistoryPayload,
  sanitizeLegacyStatusDetailPayload,
} from "@/lib/legacyServiceDetail";

describe("sanitizeLegacyStatusDetailPayload", () => {
  it("drops unsafe URLs and normalizes primitive fields", () => {
    const sanitized = sanitizeLegacyStatusDetailPayload({
      generated_at: "2026-03-08T12:00:00Z",
      health: "degraded",
      components: [
        { name: "API", status: "operational", url: "javascript:alert(1)" },
        {},
      ],
      analytics: {
        severity_key: "major",
        source_ok_count: "2",
        source_total_count: "4",
      },
      outage: {
        url: "javascript:alert(1)",
        summary: "  Active incident  ",
        reports_24h: -5,
        incidents: [{ title: "Login issue", started_at: "2026-03-08T10:00:00Z" }],
        scheduled_maintenances: [
          {
            title: "API database maintenance",
            starts_at: "2026-03-10T02:00:00Z",
            ends_at: "2026-03-10T03:30:00Z",
            status: "scheduled",
            summary: "Planned maintenance window for core API storage.",
            url: "https://status.example.com/incidents/maintenance-1",
          },
          {
            title: "Unsafe maintenance",
            url: "javascript:alert(1)",
          },
        ],
        components: [
          {
            name: "Chat Completions",
            status: "operational",
            updated_at: "2026-03-09T17:08:54Z",
            source: "OpenAI Statuspage API",
          },
          { status: "degraded" },
        ],
        services: [
          {
            service: "Platform API",
            health: "degraded",
            url: "https://status.example.com/components/api",
          },
        ],
      },
      reports: [
        { title: "Safe item", url: "https://example.com/report", source: "Forums" },
        { url: "javascript:alert(1)" },
      ],
      sources: [
        {
          source_id: "primary",
          name: "Primary Feed",
          url: "ftp://example.com/feed",
          ok: "true",
          item_count: "7",
          freshness: "fresh",
        },
      ],
      source_transparency: {
        overview: {
          confidence_score: "0.875",
        },
        sources: [
          {
            source_id: "primary",
            name: "Primary Feed",
            url: "https://status.example.com",
            latest: {
              ok: "true",
              freshness: "warm",
              duration_ms: "15",
            },
            metrics_24h: {
              success_rate: "99.5",
              stale_rate: "0.125",
              cache_hit_rate: "0.5",
            },
          },
        ],
      },
    });

    expect(sanitized.outage?.url).toBeUndefined();
    expect(sanitized.outage?.reports_24h).toBe(0);
    expect(sanitized.analytics?.source_ok_count).toBe(2);
    expect(sanitized.analytics?.source_total_count).toBe(4);
    expect(sanitized.components).toMatchObject([{ name: "API", status: "operational", url: undefined }]);
    expect(sanitized.outage?.components).toMatchObject([
      {
        name: "Chat Completions",
        status: "operational",
        updated_at: "2026-03-09T17:08:54Z",
        source: "OpenAI Statuspage API",
      },
      {
        status: "degraded",
      },
    ]);
    expect(sanitized.outage?.services).toMatchObject([
      {
        service: "Platform API",
        health: "degraded",
        url: "https://status.example.com/components/api",
      },
    ]);
    expect(sanitized.outage?.scheduled_maintenances).toMatchObject([
      {
        title: "API database maintenance",
        starts_at: "2026-03-10T02:00:00Z",
        ends_at: "2026-03-10T03:30:00Z",
        status: "scheduled",
        summary: "Planned maintenance window for core API storage.",
        url: "https://status.example.com/incidents/maintenance-1",
      },
      {
        title: "Unsafe maintenance",
        url: undefined,
      },
    ]);
    expect(sanitized.reports).toHaveLength(1);
    expect(sanitized.reports?.[0].url).toBe("https://example.com/report");
    expect(sanitized.sources?.[0]).toMatchObject({
      source_id: "primary",
      url: undefined,
      ok: true,
      item_count: 7,
      freshness: "fresh",
    });
    expect(sanitized.source_transparency?.overview?.confidence_score).toBe(87.5);
    expect(sanitized.source_transparency?.sources?.[0]).toMatchObject({
      source_id: "primary",
      url: "https://status.example.com/",
      latest: {
        ok: true,
        freshness: "warm",
        duration_ms: 15,
      },
      metrics_24h: {
        success_rate: 99.5,
        stale_rate: 12.5,
        cache_hit_rate: 50,
      },
    });
  });
});

describe("sanitizeLegacyHistoryPayload", () => {
  it("filters malformed points and normalizes nested state maps", () => {
    const sanitized = sanitizeLegacyHistoryPayload({
      updated_at: "2026-03-08T12:00:00Z",
      cadence_minutes: "5",
      retention_days: "30",
      points: [
        {
          t: "2026-03-08T11:55:00Z",
          reports_24h: "9",
          source_states: {
            primary: {
              source_id: "primary",
              ok: "true",
              freshness: "fresh",
            },
            broken: {
              ok: false,
            },
          },
          component_states: {
            login: {
              component_id: "login",
              status: "degraded",
            },
          },
        },
        {
          t: "not-a-date",
        },
      ],
    });

    expect(sanitized?.cadence_minutes).toBe(5);
    expect(sanitized?.retention_days).toBe(30);
    expect(sanitized?.points).toHaveLength(1);
    expect(sanitized?.points?.[0]).toMatchObject({
      t: "2026-03-08T11:55:00Z",
      reports_24h: 9,
      source_states: {
        primary: {
          source_id: "primary",
          ok: true,
          freshness: "fresh",
        },
      },
      component_states: {
        login: {
          component_id: "login",
          status: "degraded",
        },
      },
    });
  });
});
