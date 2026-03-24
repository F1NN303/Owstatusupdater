import AppLayout from "@/components/AppLayout";
import { GlassSection, PageIntro, PageShell } from "@/components/PageScaffold";
import ServiceIdentityIcon from "@/components/ServiceIdentityIcon";
import { useAlertAccount } from "@/lib/alertAccount";
import { pickLang, useAppShell } from "@/lib/appShell";
import { getLegacyLiveStatusServices, type LegacyHomeServiceConfig } from "@/lib/legacyStatus";
import {
  fetchLegacySubscriptionConfig,
  providerLabel,
  type LegacySubscriptionLoadResult,
} from "@/lib/legacySubscription";
import { getSupabaseClient } from "@/lib/supabase";
import { formatTimestampByMode } from "@/lib/timeDisplay";
import { cn } from "@/lib/utils";
import {
  BellRing,
  CheckCheck,
  Cloud,
  ExternalLink,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";

type NoticeTone = "neutral" | "good" | "warn" | "bad";

const STATUS_CLASS: Record<NoticeTone, string> = {
  neutral: "border-white/10 bg-white/5 text-muted-foreground",
  good: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  warn: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  bad: "border-rose-300/20 bg-rose-300/10 text-rose-200",
};

const DELIVERY_PROGRESS_STORAGE_KEY = "owstatusupdater.alerts.delivery-follow-up.v1";
const DELIVERY_PROGRESS_MAX_AGE_MS = 1000 * 60 * 60 * 48;

function readDeliveryFollowUpPending() {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const storedValue = window.localStorage.getItem(DELIVERY_PROGRESS_STORAGE_KEY);
    if (!storedValue) {
      return false;
    }
    const parsedTime = Date.parse(storedValue);
    if (!Number.isFinite(parsedTime) || Date.now() - parsedTime > DELIVERY_PROGRESS_MAX_AGE_MS) {
      window.localStorage.removeItem(DELIVERY_PROGRESS_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function writeDeliveryFollowUpPending(pending: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (pending) {
      window.localStorage.setItem(DELIVERY_PROGRESS_STORAGE_KEY, new Date().toISOString());
    } else {
      window.localStorage.removeItem(DELIVERY_PROGRESS_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures so alert setup still works in restricted browsers.
  }
}

function statusTone(result: LegacySubscriptionLoadResult | null): NoticeTone {
  if (!result || result.status === "loading") {
    return "neutral";
  }
  if (result.status === "ready") {
    return "good";
  }
  if (result.status === "missing" || result.status === "invalid") {
    return "warn";
  }
  return "bad";
}

function compareServices(a: LegacyHomeServiceConfig, b: LegacyHomeServiceConfig) {
  const aPriority = typeof a.priority === "number" ? a.priority : 1000;
  const bPriority = typeof b.priority === "number" ? b.priority : 1000;
  if (aPriority !== bPriority) {
    return aPriority - bPriority;
  }
  return a.name.localeCompare(b.name);
}

function AlertsSectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">{icon}</div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function AlertsStatusMetric({
  label,
  value,
  tone,
  caption,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  tone: NoticeTone;
  caption: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/5 p-3", className)}>
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div
        className={cn(
          "mt-2 inline-flex max-w-full whitespace-normal rounded-full border px-2 py-0.5 text-left text-[10px] font-medium leading-tight",
          STATUS_CLASS[tone],
          valueClassName
        )}
      >
        {value}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{caption}</p>
    </div>
  );
}

const EmailAlerts = () => {
  const {
    language,
    timeDisplayMode,
    favoriteServiceIds,
    alertServiceIds,
    isAlertService,
    toggleAlertService,
    replaceAlertServices,
    alertSeverityThreshold,
    setAlertSeverityThreshold,
  } = useAppShell();
  const {
    configured: alertsBackendConfigured,
    status: alertAccountStatus,
    isLoading: alertAccountLoading,
    isSaving: alertAccountSaving,
    isConnected: alertAccountConnected,
    isDirty: alertAccountDirty,
    profile: alertAccountProfile,
    savedPreferences,
    sessionEmail,
    requestMagicLink,
    signOut,
    reload: reloadAlertAccount,
    savePreferences,
  } = useAlertAccount();
  const [configResult, setConfigResult] = useState<LegacySubscriptionLoadResult | null>(null);
  const [availableServices, setAvailableServices] = useState<LegacyHomeServiceConfig[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [embedLoaded, setEmbedLoaded] = useState(false);
  const [embedTimedOut, setEmbedTimedOut] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [accountNotice, setAccountNotice] = useState<{ tone: NoticeTone; message: string } | null>(
    null
  );
  const [magicLinkPending, setMagicLinkPending] = useState(false);
  const [magicLinkSentEmail, setMagicLinkSentEmail] = useState("");
  const [deliveryFollowUpPending, setDeliveryFollowUpPending] = useState(readDeliveryFollowUpPending);
  const [deliverySyncPending, setDeliverySyncPending] = useState(false);
  const [showProviderEmbed, setShowProviderEmbed] = useState(false);
  const [serviceQuery, setServiceQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const t = (en: string, de: string) => pickLang(language, en, de);
  const favoriteServiceIdSet = useMemo(() => new Set(favoriteServiceIds), [favoriteServiceIds]);
  const alertServiceIdSet = useMemo(() => new Set(alertServiceIds), [alertServiceIds]);

  const statusText = (result: LegacySubscriptionLoadResult | null) => {
    if (!result || result.status === "loading") {
      return t("Preparing alert signup...", "Alarm-Anmeldung wird vorbereitet...");
    }
    if (result.status === "ready") {
      return `${t("Ready", "Bereit")} | ${providerLabel(result.config?.provider)} ${t("signup active", "Anmeldung aktiv")}`;
    }
    if (result.status === "missing" || result.status === "invalid") {
      return t("Alert signup is currently unavailable", "Alarm-Anmeldung ist aktuell nicht verfuegbar");
    }
    return t("Could not load alert signup right now", "Alarm-Anmeldung konnte aktuell nicht geladen werden");
  };

  const loadConfig = async () => {
    setIsRefreshing(true);
    setConfigResult(
      (previous) =>
        previous ?? {
          status: "loading",
          config: null,
          parsedUrl: null,
          source: "network",
          cachedAt: null,
        }
    );
    const result = await fetchLegacySubscriptionConfig();
    setConfigResult(result);
    setLastCheckedAt(new Date().toISOString());
    setIsRefreshing(false);
  };

  const refreshAlertSetup = () => {
    void loadConfig();
    reloadAlertAccount();
  };

  const handleCheckDeliveryStatus = async () => {
    if (!alertsBackendConfigured) {
      setAccountNotice({
        tone: "warn",
        message: t(
          "Alert account checks are not configured in this build.",
          "Alarm-Konto-Pruefungen sind in diesem Build nicht konfiguriert."
        ),
      });
      return;
    }

    if (!alertAccountConnected) {
      setAccountNotice({
        tone: "warn",
        message: t(
          "Connect your alert account first, then check delivery again.",
          "Verbinde zuerst dein Alarm-Konto und pruefe die Zustellung danach erneut."
        ),
      });
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setAccountNotice({
        tone: "bad",
        message: t(
          "Supabase is not available in this build right now.",
          "Supabase ist in diesem Build gerade nicht verfuegbar."
        ),
      });
      return;
    }

    setDeliverySyncPending(true);
    const { data, error } = await supabase.functions.invoke("sync-brevo-contact", {
      body: {},
    });
    setDeliverySyncPending(false);
    refreshAlertSetup();

    if (error) {
      setAccountNotice({
        tone: "bad",
        message:
          String(error.message || "").trim() ||
          t(
            "Could not check Brevo delivery status right now.",
            "Der Brevo-Zustellungsstatus konnte gerade nicht geprueft werden."
          ),
      });
      return;
    }

    if (data?.synced) {
      setDeliveryFollowUpPending(false);
      writeDeliveryFollowUpPending(false);
      setAccountNotice({
        tone: "good",
        message: t(
          "Delivery status synced. Account was checked against Brevo.",
          "Zustellungsstatus synchronisiert. Das Konto wurde mit Brevo abgeglichen."
        ),
      });
      return;
    }

    if (data?.contactFound === false) {
      setAccountNotice({
        tone: "warn",
        message: t(
          "No confirmed Brevo contact was found for this account e-mail yet.",
          "Fuer diese Konto-E-Mail wurde noch kein bestaetigter Brevo-Kontakt gefunden."
        ),
      });
      return;
    }

    setAccountNotice({
      tone: "warn",
      message: t(
        "Brevo contact found, but delivery is not fully active yet.",
        "Ein Brevo-Kontakt wurde gefunden, aber die Zustellung ist noch nicht voll aktiv."
      ),
    });
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getLegacyLiveStatusServices()
      .then((services) => {
        if (cancelled) {
          return;
        }
        setAvailableServices([...services].sort(compareServices));
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableServices([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (alertAccountConnected && sessionEmail) {
      setEmailDraft(sessionEmail);
      setMagicLinkSentEmail("");
    }
  }, [alertAccountConnected, sessionEmail]);

  const embedUrl = configResult?.status === "ready" ? configResult.parsedUrl?.toString() ?? "" : "";
  const canEmbed = Boolean(embedUrl);

  useEffect(() => {
    setEmbedLoaded(false);
    setEmbedTimedOut(false);

    if (!canEmbed) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setEmbedTimedOut(true);
    }, 8000);

    return () => window.clearTimeout(timeout);
  }, [canEmbed, embedUrl]);

  useEffect(() => {
    if (!canEmbed) {
      setShowProviderEmbed(false);
    }
  }, [canEmbed]);

  const provider = providerLabel(configResult?.config?.provider);
  const usingCachedConfig = configResult?.source === "cache";
  const selectedServiceCount = alertServiceIds.length;
  const sortedServices = useMemo(() => {
    return [...availableServices].sort((left, right) => {
      const leftAlert = alertServiceIdSet.has(left.id);
      const rightAlert = alertServiceIdSet.has(right.id);
      if (leftAlert !== rightAlert) {
        return leftAlert ? -1 : 1;
      }

      const leftFavorite = favoriteServiceIdSet.has(left.id);
      const rightFavorite = favoriteServiceIdSet.has(right.id);
      if (leftFavorite !== rightFavorite) {
        return leftFavorite ? -1 : 1;
      }

      return compareServices(left, right);
    });
  }, [alertServiceIdSet, availableServices, favoriteServiceIdSet]);
  const normalizedServiceQuery = serviceQuery.trim().toLowerCase();
  const visibleServices = useMemo(() => {
    return sortedServices.filter((service) => {
      if (showSelectedOnly && !alertServiceIdSet.has(service.id)) {
        return false;
      }
      if (!normalizedServiceQuery) {
        return true;
      }
      const haystack = [
        service.name,
        service.note,
        service.category,
        ...(service.tags || []),
        ...(service.aliases || []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedServiceQuery);
    });
  }, [alertServiceIdSet, normalizedServiceQuery, showSelectedOnly, sortedServices]);

  const checkedLabel = lastCheckedAt
    ? formatTimestampByMode(lastCheckedAt, {
        language,
        mode: timeDisplayMode,
        absoluteFormat: {
          hour: "2-digit",
          minute: "2-digit",
        },
        fallbackText: t("Pending", "Ausstehend"),
      })
    : t("Pending", "Ausstehend");
  const cachedConfigLabel = configResult?.cachedAt
    ? formatTimestampByMode(configResult.cachedAt, {
        language,
        mode: timeDisplayMode,
        absoluteFormat: {
          hour: "2-digit",
          minute: "2-digit",
        },
        fallbackText: t("Stored", "Gespeichert"),
      })
    : null;
  const profileLastSyncedLabel = alertAccountProfile?.lastSyncedAt
    ? formatTimestampByMode(alertAccountProfile.lastSyncedAt, {
        language,
        mode: timeDisplayMode,
        absoluteFormat: {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
        fallbackText: t("Pending", "Ausstehend"),
      })
    : t("Pending", "Ausstehend");
  const profileLastDeliveryLabel = alertAccountProfile?.lastDeliveryAt
    ? formatTimestampByMode(alertAccountProfile.lastDeliveryAt, {
        language,
        mode: timeDisplayMode,
        absoluteFormat: {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
        fallbackText: t("Pending", "Ausstehend"),
      })
    : t("Pending", "Ausstehend");
  const accountTone: NoticeTone = (() => {
    if (!alertsBackendConfigured) {
      return "warn";
    }
    if (alertAccountStatus === "error") {
      return "bad";
    }
    if (alertAccountConnected) {
      return "good";
    }
    if (alertAccountLoading || alertAccountStatus === "checking") {
      return "neutral";
    }
    return "warn";
  })();
  const connectionStatusLabel = (() => {
    if (!alertsBackendConfigured) {
      return t("Backend missing", "Backend fehlt");
    }
    if (alertAccountStatus === "error") {
      return t("Connection issue", "Verbindungsproblem");
    }
    if (alertAccountLoading || alertAccountStatus === "checking") {
      return t("Checking session", "Sitzung wird geprueft");
    }
    if (alertAccountConnected) {
      return t("Connected", "Verbunden");
    }
    return t("Not connected", "Nicht verbunden");
  })();
  const deliverySyncLabel = (() => {
    switch (alertAccountProfile?.brevoSyncStatus) {
      case "synced":
        return t("Synced", "Synchronisiert");
      case "error":
        return t("Sync issue", "Sync-Problem");
      case "not_synced":
        return alertAccountProfile?.providerContactId
          ? t("Checking signup", "Anmeldung wird geprueft")
          : t("Not connected", "Nicht verbunden");
      default:
        return t("Not connected", "Nicht verbunden");
    }
  })();
  const preferencesTone: NoticeTone = alertAccountConnected
    ? alertAccountDirty
      ? "warn"
      : "good"
    : "neutral";
  const deliveryReady = alertAccountProfile?.brevoSyncStatus === "synced";
  const deliverySyncError = alertAccountProfile?.brevoSyncStatus === "error";
  const deliveryAwaitingConfirmation =
    !deliveryReady &&
    !deliverySyncError &&
    alertAccountConnected &&
    (deliveryFollowUpPending || Boolean(alertAccountProfile?.providerContactId));
  const providerTone = deliveryReady
    ? "good"
    : deliverySyncError
      ? "bad"
      : deliveryAwaitingConfirmation
        ? "neutral"
        : canEmbed
          ? "warn"
          : statusTone(configResult);
  const preferencesStatusLabel = alertAccountConnected
    ? alertAccountDirty
      ? t("Needs save", "Speichern")
      : t("Saved", "Gespeichert")
    : t("Local only", "Nur lokal");
  const providerStatusLabel = deliveryReady
    ? t("Active", "Aktiv")
    : deliverySyncError
      ? t("Sync issue", "Sync-Problem")
      : deliveryAwaitingConfirmation
        ? t("Confirming", "Bestaetigung")
        : canEmbed
          ? t("Open delivery", "Zustellung starten")
          : t("Unavailable", "Nicht verfuegbar");
  const setupTone: NoticeTone = (() => {
    if (!alertsBackendConfigured) {
      return "warn";
    }
    if (!alertAccountConnected) {
      return "warn";
    }
    if (deliverySyncError) {
      return "warn";
    }
    if (alertAccountDirty || !deliveryReady) {
      return "neutral";
    }
    return "good";
  })();
  const setupBadgeLabel = (() => {
    if (!alertsBackendConfigured) {
      return t("Unavailable", "Nicht verfuegbar");
    }
    if (!alertAccountConnected) {
      return t("Step 1", "Schritt 1");
    }
    if (alertAccountDirty) {
      return t("Step 2", "Schritt 2");
    }
    if (!deliveryReady) {
      return t("Step 3", "Schritt 3");
    }
    return t("Ready", "Bereit");
  })();
  const setupTitle = (() => {
    if (!alertsBackendConfigured) {
      return t("Alerts account unavailable", "Alarm-Konto nicht verfuegbar");
    }
    if (!alertAccountConnected) {
      return t("Connect your alert account", "Verbinde dein Alarm-Konto");
    }
    if (alertAccountDirty) {
      return t("Save what should trigger alerts", "Speichere, was Alarme ausloesen soll");
    }
    if (deliveryAwaitingConfirmation) {
      return t("Waiting for delivery confirmation", "Warte auf Zustellungsbestaetigung");
    }
    if (!deliveryReady) {
      return t("Finish e-mail delivery", "Aktiviere die E-Mail-Zustellung");
    }
    return t("Alerts are ready", "Alarme sind bereit");
  })();
  const setupDescription = (() => {
    if (!alertsBackendConfigured) {
      return t(
        "Browser alerts are not configured in this build yet.",
        "Browser-Alarme sind in diesem Build noch nicht konfiguriert."
      );
    }
    if (!alertAccountConnected) {
      return magicLinkSentEmail
        ? t(
            `We sent a magic link to ${magicLinkSentEmail}. Open it on this device to continue.`,
            `Wir haben einen Magic Link an ${magicLinkSentEmail} gesendet. Oeffne ihn auf diesem Geraet, um fortzufahren.`
          )
        : t(
            "Step 1 is account access. After that, your watchlist can sync across devices.",
            "Schritt 1 ist der Kontozugang. Danach kann deine Watchlist ueber Geraete hinweg synchronisiert werden."
          );
    }
    if (alertAccountDirty) {
      return t(
        "Your current watchlist differs from the saved account version.",
        "Deine aktuelle Watchlist unterscheidet sich von der gespeicherten Konto-Version."
      );
    }
    if (deliveryAwaitingConfirmation) {
      return t(
        "The provider signup was already opened. Return here after confirmation and the page will check the delivery status again.",
        "Die Provider-Anmeldung wurde bereits gestartet. Kehre nach der Bestaetigung hierher zurueck, dann prueft die Seite den Zustellungsstatus erneut."
      );
    }
    if (!deliveryReady) {
      return t(
        "Preferences are saved. Finish the delivery step if you also want inbox alerts.",
        "Die Einstellungen sind gespeichert. Schliesse den Zustellungs-Schritt ab, wenn du auch E-Mail-Alarme im Postfach moechtest."
      );
    }
    return t(
      "Account, preferences, and delivery are all active.",
      "Konto, Einstellungen und Zustellung sind alle aktiv."
    );
  })();
  const watchlistModeText = alertAccountConnected
    ? alertAccountDirty
      ? t(
          "You have account changes that still need to be saved.",
          "Du hast Kontoaenderungen, die noch gespeichert werden muessen."
        )
      : t(
          "Your current watchlist already matches the saved account settings.",
          "Deine aktuelle Watchlist entspricht bereits den gespeicherten Kontoeinstellungen."
        )
    : t(
        "This watchlist still lives only on this device until you connect an alert account.",
        "Diese Watchlist lebt noch nur auf diesem Geraet, bis du ein Alarm-Konto verbindest."
      );
  const providerConnectionText = alertAccountConnected
    ? t(
        "Account preferences are already handled above. Use this provider step only for inbox delivery, then return here to confirm the final status.",
        "Die Konto-Einstellungen werden bereits oben verwaltet. Nutze diesen Provider-Schritt nur fuer die Zustellung ins Postfach und kehre danach hierher zur Statuspruefung zurueck."
      )
    : t(
        "This is the final delivery step. Connect your alert account first if you want one clearer setup flow.",
        "Das ist der letzte Zustellungs-Schritt. Verbinde zuerst dein Alarm-Konto, wenn du einen klaren Setup-Ablauf moechtest."
      );

  useEffect(() => {
    if (!alertAccountConnected || deliveryReady || deliverySyncError) {
      setDeliveryFollowUpPending(false);
      writeDeliveryFollowUpPending(false);
    }
  }, [alertAccountConnected, deliveryReady, deliverySyncError]);

  useEffect(() => {
    if (!deliveryAwaitingConfirmation) {
      return;
    }

    const recheckDeliveryStatus = () => {
      reloadAlertAccount();
    };
    const handleResume = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      recheckDeliveryStatus();
    };

    const interval = window.setInterval(recheckDeliveryStatus, 15000);
    window.addEventListener("focus", handleResume);
    document.addEventListener("visibilitychange", handleResume);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
    };
  }, [deliveryAwaitingConfirmation, reloadAlertAccount]);

  const handleRequestMagicLink = async () => {
    setMagicLinkPending(true);
    const result = await requestMagicLink(emailDraft);
    setMagicLinkPending(false);
    if (result.ok) {
      setMagicLinkSentEmail(emailDraft.trim());
    }
    setAccountNotice({
      tone: result.ok ? "good" : "bad",
      message: result.message,
    });
  };

  const handleEmailDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || magicLinkPending || !alertsBackendConfigured) {
      return;
    }
    event.preventDefault();
    void handleRequestMagicLink();
  };

  const handleSavePreferences = async () => {
    const result = await savePreferences();
    setAccountNotice({
      tone: result.ok ? "good" : "bad",
      message: result.message,
    });
  };

  const handleSignOut = async () => {
    const result = await signOut();
    if (result.ok) {
      setMagicLinkSentEmail("");
      setShowProviderEmbed(false);
    }
    setAccountNotice({
      tone: result.ok ? "neutral" : "bad",
      message: result.message,
    });
  };

  return (
    <AppLayout>
      <PageShell>
        <PageIntro
          title={t("Alerts", "Alarme")}
          description={t(
            "Connect your account, choose what matters, then finish e-mail delivery if you want inbox alerts.",
            "Verbinde dein Konto, waehle die wichtigen Services und aktiviere danach bei Bedarf die E-Mail-Zustellung."
          )}
          action={
            <button
              type="button"
              onClick={refreshAlertSetup}
              className="glass flex h-12 w-12 items-center justify-center rounded-2xl transition-all active:scale-95"
              aria-label={t("Refresh alert setup", "Alarm-Einrichtung aktualisieren")}
            >
              <RefreshCw
                size={18}
                className={`text-muted-foreground transition-transform ${
                  isRefreshing || alertAccountLoading ? "animate-spin" : ""
                }`}
              />
            </button>
          }
        />

        <section className="glass glass-specular overflow-hidden rounded-2xl">
          <div className="bg-gradient-to-r from-primary/15 to-transparent p-4">
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <ShieldCheck size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-primary/80">
                    {t("Alerts flow", "Alarm-Ablauf")}
                  </p>
                  <h2 className="truncate text-sm font-bold text-foreground">{setupTitle}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{setupDescription}</p>
                </div>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_CLASS[setupTone]}`}
              >
                {setupBadgeLabel}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <AlertsStatusMetric
                label={t("Account", "Konto")}
                value={connectionStatusLabel}
                tone={accountTone}
                caption={
                  alertAccountConnected
                    ? sessionEmail || t("Unknown", "Unbekannt")
                    : t("Use the magic link to connect.", "Nutze den Magic Link zum Verbinden.")
                }
              />
              <AlertsStatusMetric
                label={t("Preferences", "Einstellungen")}
                value={preferencesStatusLabel}
                tone={preferencesTone}
                caption={
                  alertAccountConnected
                    ? t(
                        `${selectedServiceCount} services currently selected.`,
                        `${selectedServiceCount} Services sind aktuell ausgewaehlt.`
                      )
                    : t(
                        `${selectedServiceCount} services are only stored on this device right now.`,
                        `${selectedServiceCount} Services sind aktuell nur auf diesem Geraet gespeichert.`
                      )
                }
              />
              <AlertsStatusMetric
                label={t("Delivery", "Zustellung")}
                value={providerStatusLabel}
                tone={providerTone}
                caption={deliveryReady ? provider : t("Brevo delivery step still open.", "Brevo-Zustellung ist noch offen.")}
              />
            </div>
          </div>
        </section>

        <GlassSection className="mt-4">
            <AlertsSectionHeader
              icon={<Cloud size={16} className="text-primary" />}
              title={t("1. Account access", "1. Kontozugang")}
              description={t(
                "Connect once with a magic link, then this account can keep your alert preferences.",
                "Verbinde dich einmal per Magic Link, dann kann dieses Konto deine Alarm-Einstellungen speichern."
              )}
            />

            {alertAccountConnected ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {t("Connected e-mail", "Verbundene E-Mail")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {sessionEmail || t("Unknown", "Unbekannt")}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {t(
                      "This account is now the source of truth for saved alert preferences.",
                      "Dieses Konto ist jetzt die Quelle fuer gespeicherte Alarm-Einstellungen."
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {t("Last sync", "Letzte Sync")}
                    </p>
                    <p className="mt-1 text-xs font-medium text-foreground">{profileLastSyncedLabel}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {t("Last delivery", "Letzte Zustellung")}
                    </p>
                    <p className="mt-1 text-xs font-medium text-foreground">{profileLastDeliveryLabel}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <LogOut size={14} />
                      {t("Sign out", "Abmelden")}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {t("Sign in with e-mail", "Mit E-Mail anmelden")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={emailDraft}
                      onChange={(event) => setEmailDraft(event.target.value)}
                      onKeyDown={handleEmailDraftKeyDown}
                      placeholder={t("name@example.com", "name@example.com")}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                    />
                    <button
                      type="button"
                      onClick={() => void handleRequestMagicLink()}
                      disabled={magicLinkPending || !alertsBackendConfigured}
                      className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {magicLinkPending ? t("Sending...", "Sendet...") : t("Send link", "Link senden")}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {t(
                      "We use a secure magic link instead of a password for alert-account access.",
                      "Wir nutzen einen sicheren Magic Link statt eines Passworts fuer den Zugriff auf das Alarm-Konto."
                    )}
                  </p>
                </div>

                {magicLinkSentEmail ? (
                  <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-[11px] text-emerald-200">
                    {t(
                      `Magic link sent to ${magicLinkSentEmail}. Open it on this device, then return here.`,
                      `Magic Link an ${magicLinkSentEmail} gesendet. Oeffne ihn auf diesem Geraet und kehre dann hierher zurueck.`
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {accountNotice ? (
              <div className={`mt-3 rounded-xl border px-3 py-2 text-[11px] ${STATUS_CLASS[accountNotice.tone]}`}>
                {accountNotice.message}
              </div>
            ) : null}
        </GlassSection>

        {usingCachedConfig ? (
          <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-[11px] text-amber-200">
            <p className="font-semibold">
              {t("Showing last known signup settings", "Letzte bekannte Anmelde-Einstellungen werden angezeigt")}
            </p>
            <p className="mt-0.5 opacity-90">
              {cachedConfigLabel
                ? t(
                    `Stored configuration from ${cachedConfigLabel} is being used while the connection recovers.`,
                    `Gespeicherte Konfiguration von ${cachedConfigLabel} wird verwendet, waehrend sich die Verbindung erholt.`
                  )
                : t(
                    "A previously saved configuration is being used while the connection recovers.",
                    "Eine zuvor gespeicherte Konfiguration wird verwendet, waehrend sich die Verbindung erholt."
                  )}
            </p>
          </div>
        ) : null}

        <GlassSection className="mt-4">
            <AlertsSectionHeader
              icon={<BellRing size={16} className="text-primary" />}
              title={t("2. Choose alerts", "2. Alarme auswaehlen")}
              description={
                alertAccountConnected
                  ? t(
                      "Pick the services and threshold you want to save into your account.",
                      "Waehle die Services und die Schwelle, die in deinem Konto gespeichert werden sollen."
                    )
                  : t(
                      "You can prepare this before sign-in. Until then, it stays only on this device.",
                      "Du kannst das vor der Anmeldung vorbereiten. Bis dahin bleibt es nur auf diesem Geraet."
                    )
              }
            />

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Watching", "Beobachtet")}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">{selectedServiceCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Favorites", "Favoriten")}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">{favoriteServiceIds.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {t("Threshold", "Schwelle")}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {alertSeverityThreshold === "degraded"
                    ? t("Degraded+", "Beeintraechtigt+")
                    : t("Major only", "Nur groessere")}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-muted-foreground">{watchlistModeText}</p>

            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {t("Alert threshold", "Alarm-Schwelle")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[
                  {
                    key: "major" as const,
                    label: t("Major only", "Nur groessere"),
                    note: t("Only larger outages should stand out.", "Nur groessere Ausfaelle sollen hervorstechen."),
                  },
                  {
                    key: "degraded" as const,
                    label: t("Degraded + major", "Beeintraechtigt + groesser"),
                    note: t("Also flag smaller degraded states.", "Auch kleinere Beeintraechtigungen hervorheben."),
                  },
                ].map((option) => {
                  const active = alertSeverityThreshold === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setAlertSeverityThreshold(option.key)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        active
                          ? "border-primary/35 bg-primary/15 text-primary"
                          : "border-white/10 bg-black/20 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {alertSeverityThreshold === "degraded"
                  ? t(
                      "Smaller degraded states will be treated as watchlist-worthy in the UI.",
                      "Kleinere Beeintraechtigungen gelten in der UI ebenfalls als watchlist-relevant."
                    )
                  : t(
                      "The watchlist stays focused on the most severe outages.",
                      "Die Watchlist konzentriert sich auf die schwerwiegendsten Ausfaelle."
                    )}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => replaceAlertServices(favoriteServiceIds)}
                className="flex-1 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/15"
              >
                {t("Import favorites", "Favoriten uebernehmen")}
              </button>
              <button
                type="button"
                onClick={() => replaceAlertServices([])}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10"
              >
                {t("Clear", "Leeren")}
              </button>
              {alertAccountConnected ? (
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  disabled={alertAccountSaving || (!alertAccountDirty && Boolean(savedPreferences))}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCheck size={14} />
                    {alertAccountSaving
                      ? t("Saving...", "Speichert...")
                      : alertAccountDirty
                        ? t("Save to account", "Im Konto speichern")
                        : t("Saved", "Gespeichert")}
                  </span>
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-muted-foreground focus-within:border-primary/30 focus-within:text-foreground">
                  <Search size={14} className="shrink-0" />
                  <input
                    type="text"
                    value={serviceQuery}
                    onChange={(event) => setServiceQuery(event.target.value)}
                    placeholder={t("Search services", "Services suchen")}
                    className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowSelectedOnly((previous) => !previous)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                    showSelectedOnly
                      ? "border-primary/25 bg-primary/12 text-primary"
                      : "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
                  }`}
                >
                  {showSelectedOnly ? t("Selected only", "Nur ausgewaehlte") : t("Show all", "Alle zeigen")}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {visibleServices.length === sortedServices.length
                  ? t(
                      `${visibleServices.length} services are currently visible.`,
                      `${visibleServices.length} Services sind aktuell sichtbar.`
                    )
                  : t(
                      `Showing ${visibleServices.length} of ${sortedServices.length} services.`,
                      `${visibleServices.length} von ${sortedServices.length} Services werden angezeigt.`
                    )}
              </p>
            </div>

            <div className="mt-3 space-y-2">
              {sortedServices.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-muted-foreground">
                  {t(
                    "Service watchlist controls will appear as soon as the live service catalog loads.",
                    "Die Service-Watchlist erscheint, sobald der Live-Servicekatalog geladen ist."
                  )}
                </div>
              ) : visibleServices.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-muted-foreground">
                  {t(
                    "No services match the current filter yet. Clear the search or show all services again.",
                    "Keine Services passen aktuell zum Filter. Leere die Suche oder zeige wieder alle Services an."
                  )}
                </div>
              ) : (
                visibleServices.map((service) => {
                  const selected = isAlertService(service.id);
                  const favorite = favoriteServiceIdSet.has(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => toggleAlertService(service.id)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        selected
                          ? "border-primary/25 bg-primary/12"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ServiceIdentityIcon
                          serviceId={service.id}
                          iconName={service.iconName}
                          size={16}
                          containerClassName="h-9 w-9 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-semibold text-foreground">{service.name}</p>
                            {favorite ? <Star size={12} className="text-amber-200" /> : null}
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {service.note || t("Live service status and incident summary.", "Live-Service-Status und Vorfalluebersicht.")}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          selected
                            ? "border-primary/30 bg-primary/15 text-primary"
                            : "border-white/10 bg-black/20 text-muted-foreground"
                        }`}
                      >
                        {selected ? t("Watching", "Beobachtet") : t("Off", "Aus")}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
        </GlassSection>

        <GlassSection className="mt-4">
            <AlertsSectionHeader
              icon={<Mail size={16} className="text-primary" />}
              title={t("3. Activate e-mail delivery", "3. E-Mail-Zustellung aktivieren")}
              description={providerConnectionText}
            />

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <AlertsStatusMetric
                label={t("Provider", "Provider")}
                value={provider}
                tone="neutral"
                caption={statusText(configResult)}
              />
              <AlertsStatusMetric
                label={t("Status", "Status")}
                value={providerStatusLabel}
                tone={providerTone}
                caption={
                  deliveryReady
                    ? t("Inbox delivery looks active.", "Die Postfach-Zustellung wirkt aktiv.")
                    : deliverySyncError
                      ? t(
                          "The provider delivery status could not be confirmed cleanly yet.",
                          "Der Provider-Zustellungsstatus konnte noch nicht sauber bestaetigt werden."
                        )
                      : deliveryAwaitingConfirmation
                        ? t(
                            "Confirmation looks in progress. Return here after the provider step and check again if needed.",
                            "Die Bestaetigung wirkt noch unterwegs. Kehre nach dem Provider-Schritt hierher zurueck und pruefe bei Bedarf erneut."
                          )
                        : t(
                            "Open the provider step if you still want e-mail delivery.",
                            "Oeffne den Provider-Schritt, wenn du weiter E-Mail-Zustellung moechtest."
                          )
                }
              />
              <AlertsStatusMetric
                label={t("Checked", "Geprueft")}
                value={checkedLabel}
                tone={usingCachedConfig ? "warn" : "neutral"}
                caption={
                  usingCachedConfig
                    ? t("Using cached signup metadata.", "Es werden zwischengespeicherte Anmelde-Metadaten verwendet.")
                    : t(
                        "Brevo handles captcha and double opt-in.",
                        "Brevo verarbeitet Captcha und Double-Opt-In."
                      )
                }
              />
            </div>

            {canEmbed ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <a
                    href={embedUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      setDeliveryFollowUpPending(true);
                      writeDeliveryFollowUpPending(true);
                    }}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/15 sm:w-auto"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {t("Open secure delivery form", "Sicheres Zustellungsformular oeffnen")}
                      <ExternalLink size={14} />
                    </span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProviderEmbed((previous) => {
                        const nextValue = !previous;
                        if (nextValue) {
                          setDeliveryFollowUpPending(true);
                          writeDeliveryFollowUpPending(true);
                        }
                        return nextValue;
                      });
                    }}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10 sm:w-auto"
                  >
                    {showProviderEmbed
                      ? t("Hide embedded form", "Eingebettetes Formular ausblenden")
                      : t("Show embedded form here", "Formular hier einblenden")}
                  </button>
                      <button
                        type="button"
                        onClick={() => void handleCheckDeliveryStatus()}
                        disabled={deliverySyncPending || isRefreshing || alertAccountLoading}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                      >
                        {deliverySyncPending
                          ? t("Syncing delivery...", "Synchronisiere Zustellung...")
                          : isRefreshing || alertAccountLoading
                          ? t("Checking status...", "Pruefe Status...")
                          : t("Check delivery status", "Zustellungsstatus pruefen")}
                      </button>
                </div>

                {deliveryAwaitingConfirmation ? (
                  <div className="rounded-xl border border-sky-300/20 bg-sky-400/10 px-3 py-2.5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[11px] leading-relaxed text-sky-100/90">
                        {t(
                          "If you already finished the provider form, come back here and re-check. This page also checks again when you return to it.",
                          "Wenn du das Provider-Formular schon abgeschlossen hast, kehre hierher zurueck und pruefe erneut. Diese Seite prueft auch noch einmal, wenn du zu ihr zurueckkommst."
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={refreshAlertSetup}
                        disabled={isRefreshing || alertAccountLoading}
                        className="rounded-xl border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-sm font-medium text-sky-100 transition-colors hover:bg-sky-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isRefreshing || alertAccountLoading
                          ? t("Checking...", "Prueft...")
                          : t("Check status", "Status pruefen")}
                      </button>
                    </div>
                  </div>
                ) : null}

                {showProviderEmbed ? (
                  <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                      {!embedLoaded ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                          <p className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] text-muted-foreground">
                            {t("Loading secure signup form...", "Lade sicheres Anmeldeformular...")}
                          </p>
                        </div>
                      ) : null}
                      <iframe
                        key={embedUrl}
                        src={embedUrl}
                        title={t("Brevo alert signup", "Brevo-Alarm-Anmeldung")}
                        className="block h-[640px] w-full bg-white min-[420px]:h-[720px]"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-top-navigation-by-user-activation"
                        onLoad={() => {
                          setEmbedLoaded(true);
                          setEmbedTimedOut(false);
                        }}
                      />
                    </div>

                    {embedTimedOut && !embedLoaded ? (
                      <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-200">
                        <p>
                          {t(
                            "The embedded form is taking too long to load. Open the secure provider form directly instead.",
                            "Das eingebettete Formular braucht zu lange. Oeffne stattdessen direkt das sichere Provider-Formular."
                          )}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
                    {t(
                      "On phones, the direct secure form is usually the smoother option. Open the embedded form only when you want to finish the provider step inside the app.",
                      "Auf dem Handy ist das direkte sichere Formular meistens die angenehmere Option. Oeffne das eingebettete Formular nur, wenn du den Provider-Schritt direkt in der App abschliessen willst."
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-muted-foreground">
                {t(
                  "Subscription form is not available right now. Please try again later.",
                  "Abo-Formular ist aktuell nicht verfuegbar. Bitte versuche es spaeter erneut."
                )}
              </div>
            )}
        </GlassSection>
      </PageShell>
    </AppLayout>
  );
};

export default EmailAlerts;
