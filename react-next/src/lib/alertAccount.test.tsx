import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShellProvider } from "@/lib/appShell";
import { AlertAccountProvider, useAlertAccount } from "./alertAccount";

const supabaseMock = vi.hoisted(() => {
  const session = {
    user: {
      id: "user-1",
      email: "alerts@example.com",
    },
  };
  const getSession = vi.fn();
  const onAuthStateChange = vi.fn(() => ({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  }));
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => {
          if (table === "profiles") {
            return {
              data: {
                user_id: session.user.id,
                email: session.user.email,
                connection_status: "active",
                brevo_sync_status: "not_synced",
              },
              error: null,
            };
          }

          return {
            data: {
              user_id: session.user.id,
              alerts_enabled: true,
              severity_threshold: "major",
              watched_service_ids: ["openai", "github"],
              favorite_sync_enabled: false,
              updated_at: "2026-04-26T12:00:00Z",
            },
            error: null,
          };
        }),
      })),
    })),
  }));

  const client = {
    auth: {
      getSession,
      onAuthStateChange,
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
    },
    from,
  };

  return {
    session,
    getSession,
    onAuthStateChange,
    from,
    client,
  };
});

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: true,
  getSupabaseClient: () => supabaseMock.client,
}));

function AlertAccountProbe() {
  const { status, isDirty, isLoading } = useAlertAccount();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="dirty">{isDirty ? "dirty" : "clean"}</span>
      <span data-testid="loading">{isLoading ? "loading" : "idle"}</span>
    </div>
  );
}

function renderProbe() {
  return render(
    <AppShellProvider>
      <AlertAccountProvider>
        <AlertAccountProbe />
      </AlertAccountProvider>
    </AppShellProvider>
  );
}

describe("AlertAccountProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    supabaseMock.getSession.mockReset();
    supabaseMock.onAuthStateChange.mockClear();
    supabaseMock.from.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not mark saved watchlists dirty when only the service order differs", async () => {
    window.localStorage.setItem(
      "owstatusupdater.react.settings.v2",
      JSON.stringify({
        schemaVersion: 4,
        alerts: {
          watchedServiceIds: ["github", "openai"],
          severityThreshold: "major",
        },
      })
    );
    supabaseMock.getSession.mockResolvedValue({
      data: { session: supabaseMock.session },
      error: null,
    });

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("connected"));
    expect(screen.getByTestId("dirty")).toHaveTextContent("clean");
  });

  it("leaves checking state when session bootstrap throws", async () => {
    supabaseMock.getSession.mockRejectedValue(new Error("network down"));

    renderProbe();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(screen.getByTestId("loading")).toHaveTextContent("idle");
  });
});
