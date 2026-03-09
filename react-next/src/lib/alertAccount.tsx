import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { type Session } from "@supabase/supabase-js";
import { useAppShell, type AppAlertSeverityThreshold } from "@/lib/appShell";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

type AlertAccountLifecycle = "disabled" | "checking" | "signed_out" | "connected" | "error";
type AlertProfileConnectionStatus = "pending" | "active" | "sync_error" | "disconnected";
type AlertBrevoSyncStatus = "not_synced" | "synced" | "error";

interface AlertAccountProfile {
  userId: string;
  email: string;
  connectionStatus: AlertProfileConnectionStatus;
  brevoSyncStatus: AlertBrevoSyncStatus;
  providerContactId: string | null;
  lastSyncedAt: string | null;
  lastDeliveryAt: string | null;
}

interface SavedAlertPreferences {
  userId: string;
  alertsEnabled: boolean;
  severityThreshold: AppAlertSeverityThreshold;
  watchedServiceIds: string[];
  favoriteSyncEnabled: boolean;
  updatedAt: string | null;
}

interface AlertAccountActionResult {
  ok: boolean;
  message: string;
}

interface AlertAccountContextValue {
  configured: boolean;
  status: AlertAccountLifecycle;
  isLoading: boolean;
  isSaving: boolean;
  isConnected: boolean;
  isDirty: boolean;
  profile: AlertAccountProfile | null;
  savedPreferences: SavedAlertPreferences | null;
  sessionEmail: string | null;
  requestMagicLink: (email: string) => Promise<AlertAccountActionResult>;
  signOut: () => Promise<AlertAccountActionResult>;
  reload: () => void;
  savePreferences: () => Promise<AlertAccountActionResult>;
}

interface RawProfileRecord {
  user_id?: unknown;
  email?: unknown;
  connection_status?: unknown;
  brevo_sync_status?: unknown;
  provider_contact_id?: unknown;
  last_synced_at?: unknown;
  last_delivery_at?: unknown;
}

interface RawAlertPreferencesRecord {
  user_id?: unknown;
  alerts_enabled?: unknown;
  severity_threshold?: unknown;
  watched_service_ids?: unknown;
  favorite_sync_enabled?: unknown;
  updated_at?: unknown;
}

const AlertAccountContext = createContext<AlertAccountContextValue | null>(null);

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeServiceId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, 64);
}

function normalizeServiceIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  const next: string[] = [];
  for (const item of value) {
    const normalized = normalizeServiceId(item);
    if (!normalized || next.includes(normalized)) {
      continue;
    }
    next.push(normalized);
    if (next.length >= 64) {
      break;
    }
  }
  return next;
}

function normalizeAlertThreshold(value: unknown): AppAlertSeverityThreshold {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "degraded" ? "degraded" : "major";
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return fallback;
}

function normalizeIsoTimestamp(value: unknown) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizeProfileConnectionStatus(value: unknown): AlertProfileConnectionStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "pending" ||
    normalized === "active" ||
    normalized === "sync_error" ||
    normalized === "disconnected"
  ) {
    return normalized;
  }
  return "pending";
}

function normalizeBrevoSyncStatus(value: unknown): AlertBrevoSyncStatus {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "synced" || normalized === "error" || normalized === "not_synced") {
    return normalized;
  }
  return "not_synced";
}

function sanitizeProfile(record: RawProfileRecord | null, session: Session): AlertAccountProfile {
  return {
    userId: String(record?.user_id || session.user.id),
    email: normalizeEmail(record?.email || session.user.email),
    connectionStatus: normalizeProfileConnectionStatus(record?.connection_status || "active"),
    brevoSyncStatus: normalizeBrevoSyncStatus(record?.brevo_sync_status),
    providerContactId: String(record?.provider_contact_id || "").trim() || null,
    lastSyncedAt: normalizeIsoTimestamp(record?.last_synced_at),
    lastDeliveryAt: normalizeIsoTimestamp(record?.last_delivery_at),
  };
}

function buildDefaultSavedPreferences(session: Session): SavedAlertPreferences {
  return {
    userId: session.user.id,
    alertsEnabled: true,
    severityThreshold: "major",
    watchedServiceIds: [],
    favoriteSyncEnabled: false,
    updatedAt: null,
  };
}

function sanitizeSavedPreferences(
  record: RawAlertPreferencesRecord | null,
  session: Session
): SavedAlertPreferences {
  const fallback = buildDefaultSavedPreferences(session);
  if (!record) {
    return fallback;
  }
  return {
    userId: String(record.user_id || fallback.userId),
    alertsEnabled: normalizeBoolean(record.alerts_enabled, fallback.alertsEnabled),
    severityThreshold: normalizeAlertThreshold(record.severity_threshold),
    watchedServiceIds: normalizeServiceIds(record.watched_service_ids),
    favoriteSyncEnabled: normalizeBoolean(record.favorite_sync_enabled, fallback.favoriteSyncEnabled),
    updatedAt: normalizeIsoTimestamp(record.updated_at),
  };
}

function buildAlertRedirectUrl() {
  if (typeof window === "undefined") {
    return undefined;
  }
  const baseUrl = String(import.meta.env.BASE_URL || "/").trim() || "/";
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL("alerts", new URL(normalizedBaseUrl, window.location.origin)).toString();
}

function haveSameServiceIds(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function shouldApplyRemotePreferences(
  remote: SavedAlertPreferences,
  localServiceIds: string[],
  localThreshold: AppAlertSeverityThreshold
) {
  const remoteHasCustomState =
    remote.watchedServiceIds.length > 0 || remote.severityThreshold !== "major";
  const localHasCustomState = localServiceIds.length > 0 || localThreshold !== "major";
  return remoteHasCustomState || !localHasCustomState;
}

export function AlertAccountProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseClient();
  const configured = isSupabaseConfigured && Boolean(supabase);
  const {
    alertServiceIds,
    alertSeverityThreshold,
    replaceAlertServices,
    setAlertSeverityThreshold,
  } = useAppShell();
  const localPreferencesRef = useRef({
    watchedServiceIds: alertServiceIds,
    severityThreshold: alertSeverityThreshold,
  });
  const [status, setStatus] = useState<AlertAccountLifecycle>(configured ? "checking" : "disabled");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AlertAccountProfile | null>(null);
  const [savedPreferences, setSavedPreferences] = useState<SavedAlertPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(configured);
  const [isSaving, setIsSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    localPreferencesRef.current = {
      watchedServiceIds: alertServiceIds,
      severityThreshold: alertSeverityThreshold,
    };
  }, [alertServiceIds, alertSeverityThreshold]);

  useEffect(() => {
    if (!configured || !supabase) {
      setStatus("disabled");
      setIsLoading(false);
      return;
    }

    let active = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }
      if (error) {
        setStatus("error");
        setIsLoading(false);
        return;
      }
      setSession(data.session ?? null);
      setStatus(data.session ? "checking" : "signed_out");
      setIsLoading(Boolean(data.session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setStatus(nextSession ? "checking" : "signed_out");
      if (!nextSession) {
        setProfile(null);
        setSavedPreferences(null);
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [configured, supabase]);

  useEffect(() => {
    if (!configured || !supabase) {
      return;
    }
    if (!session) {
      setStatus("signed_out");
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAlertAccount() {
      setIsLoading(true);
      setStatus("checking");

      const [profileResult, preferencesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "user_id, email, connection_status, brevo_sync_status, provider_contact_id, last_synced_at, last_delivery_at"
          )
          .eq("user_id", session.user.id)
          .maybeSingle(),
        supabase
          .from("alert_preferences")
          .select(
            "user_id, alerts_enabled, severity_threshold, watched_service_ids, favorite_sync_enabled, updated_at"
          )
          .eq("user_id", session.user.id)
          .maybeSingle(),
      ]);

      if (cancelled) {
        return;
      }

      if (profileResult.error || preferencesResult.error) {
        setStatus("error");
        setIsLoading(false);
        return;
      }

      const nextProfile = sanitizeProfile(
        (profileResult.data as RawProfileRecord | null) ?? null,
        session
      );
      const nextSavedPreferences = sanitizeSavedPreferences(
        (preferencesResult.data as RawAlertPreferencesRecord | null) ?? null,
        session
      );

      setProfile(nextProfile);
      setSavedPreferences(nextSavedPreferences);
      setStatus("connected");
      setIsLoading(false);

      const localSnapshot = localPreferencesRef.current;
      if (
        shouldApplyRemotePreferences(
          nextSavedPreferences,
          localSnapshot.watchedServiceIds,
          localSnapshot.severityThreshold
        )
      ) {
        replaceAlertServices(nextSavedPreferences.watchedServiceIds);
        setAlertSeverityThreshold(nextSavedPreferences.severityThreshold);
      }
    }

    void loadAlertAccount();

    return () => {
      cancelled = true;
    };
  }, [configured, reloadToken, replaceAlertServices, session, setAlertSeverityThreshold, supabase]);

  const sessionEmail = normalizeEmail(profile?.email || session?.user.email);
  const isConnected = status === "connected" && Boolean(session);
  const isDirty =
    isConnected &&
    Boolean(savedPreferences) &&
    (!haveSameServiceIds(alertServiceIds, savedPreferences?.watchedServiceIds ?? []) ||
      alertSeverityThreshold !== savedPreferences?.severityThreshold);

  const value = useMemo<AlertAccountContextValue>(
    () => ({
      configured,
      status,
      isLoading,
      isSaving,
      isConnected,
      isDirty,
      profile,
      savedPreferences,
      sessionEmail: sessionEmail || null,
      requestMagicLink: async (email) => {
        if (!configured || !supabase) {
          return {
            ok: false,
            message: "Supabase is not configured in this build.",
          };
        }
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
          return {
            ok: false,
            message: "Enter a valid e-mail address first.",
          };
        }
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            emailRedirectTo: buildAlertRedirectUrl(),
          },
        });
        if (error) {
          return {
            ok: false,
            message: error.message,
          };
        }
        return {
          ok: true,
          message: "Check your inbox for the sign-in link.",
        };
      },
      signOut: async () => {
        if (!configured || !supabase) {
          return {
            ok: false,
            message: "Supabase is not configured in this build.",
          };
        }
        const { error } = await supabase.auth.signOut();
        if (error) {
          return {
            ok: false,
            message: error.message,
          };
        }
        setProfile(null);
        setSavedPreferences(null);
        setStatus("signed_out");
        return {
          ok: true,
          message: "Signed out from the alert account.",
        };
      },
      reload: () => {
        setReloadToken((previous) => previous + 1);
      },
      savePreferences: async () => {
        if (!configured || !supabase || !session) {
          return {
            ok: false,
            message: "Connect an alert account before saving preferences.",
          };
        }

        setIsSaving(true);
        const payload = {
          user_id: session.user.id,
          alerts_enabled: true,
          severity_threshold: alertSeverityThreshold,
          watched_service_ids: normalizeServiceIds(alertServiceIds),
          favorite_sync_enabled: false,
        };
        const { data, error } = await supabase
          .from("alert_preferences")
          .upsert(payload, { onConflict: "user_id" })
          .select(
            "user_id, alerts_enabled, severity_threshold, watched_service_ids, favorite_sync_enabled, updated_at"
          )
          .single();
        setIsSaving(false);

        if (error) {
          return {
            ok: false,
            message: error.message,
          };
        }

        const nextSavedPreferences = sanitizeSavedPreferences(
          data as RawAlertPreferencesRecord,
          session
        );
        setSavedPreferences(nextSavedPreferences);
        return {
          ok: true,
          message: "Alert preferences saved to your account.",
        };
      },
    }),
    [
      alertServiceIds,
      alertSeverityThreshold,
      configured,
      isConnected,
      isDirty,
      isLoading,
      isSaving,
      profile,
      savedPreferences,
      session,
      sessionEmail,
      status,
      supabase,
    ]
  );

  return <AlertAccountContext.Provider value={value}>{children}</AlertAccountContext.Provider>;
}

export function useAlertAccount() {
  const context = useContext(AlertAccountContext);
  if (!context) {
    throw new Error("useAlertAccount must be used within AlertAccountProvider");
  }
  return context;
}
