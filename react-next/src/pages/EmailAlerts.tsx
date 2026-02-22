import AppLayout from "@/components/AppLayout";
import { resolveLegacyPath } from "@/lib/legacySite";
import {
  fetchLegacySubscriptionConfig,
  isLikelyEmail,
  providerLabel,
  type LegacySubscriptionLoadResult,
} from "@/lib/legacySubscription";
import { ExternalLink, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type NoticeTone = "neutral" | "good" | "warn" | "bad";

function formatHost(url: URL | null) {
  if (!url) {
    return "Unavailable";
  }
  return url.hostname;
}

function statusText(result: LegacySubscriptionLoadResult | null) {
  if (!result) {
    return "Loading subscription config...";
  }
  if (result.status === "ready") {
    return `Ready · ${providerLabel(result.config?.provider)} form verified`;
  }
  if (result.status === "loading") {
    return "Loading subscription config...";
  }
  if (result.status === "missing") {
    return "Subscription form is not configured";
  }
  if (result.status === "invalid") {
    return "Subscription config is invalid";
  }
  return "Could not load subscription config";
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

const STATUS_CLASS: Record<NoticeTone, string> = {
  neutral: "border-white/10 bg-white/5 text-muted-foreground",
  good: "border-emerald-300/20 bg-emerald-400/10 text-emerald-200",
  warn: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  bad: "border-rose-300/20 bg-rose-300/10 text-rose-200",
};

const EmailAlerts = () => {
  const [email, setEmail] = useState("");
  const [configResult, setConfigResult] = useState<LegacySubscriptionLoadResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string>("Captcha and double opt-in continue on the secure form page.");
  const [submitTone, setSubmitTone] = useState<NoticeTone>("neutral");

  const loadConfig = async () => {
    setIsRefreshing(true);
    setConfigResult((previous) => previous ?? { status: "loading", config: null, parsedUrl: null });
    const result = await fetchLegacySubscriptionConfig();
    setConfigResult(result);
    setLastCheckedAt(new Date().toISOString());
    setIsRefreshing(false);

    if (result.status === "ready") {
      setSubmitNotice("Secure signup is ready. Enter your email to continue to the Brevo form.");
      setSubmitTone("good");
    } else if (result.status === "missing" || result.status === "invalid") {
      setSubmitNotice(result.message || "Subscription config is not ready.");
      setSubmitTone("warn");
    } else if (result.status === "error") {
      setSubmitNotice(result.message || "Could not load subscription config.");
      setSubmitTone("bad");
    } else {
      setSubmitNotice("Loading subscription config...");
      setSubmitTone("neutral");
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  const provider = providerLabel(configResult?.config?.provider);
  const currentTone = statusTone(configResult);
  const canSubmit = configResult?.status === "ready" && Boolean(configResult.parsedUrl);

  const checkedLabel = useMemo(() => {
    if (!lastCheckedAt) {
      return "Check: pending";
    }
    const date = new Date(lastCheckedAt);
    if (!Number.isFinite(date.getTime())) {
      return "Check: pending";
    }
    return `Check: ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }, [lastCheckedAt]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit || !configResult?.parsedUrl) {
      setSubmitNotice(configResult?.message || "Subscription form is not available right now.");
      setSubmitTone(configResult?.status === "error" ? "bad" : "warn");
      return;
    }

    const nextEmail = String(email || "").trim();
    if (!isLikelyEmail(nextEmail)) {
      setSubmitNotice("Please enter a valid email address.");
      setSubmitTone("warn");
      return;
    }

    const targetUrl = new URL(configResult.parsedUrl.toString());
    targetUrl.searchParams.set("email", nextEmail);
    window.open(targetUrl.toString(), "_blank", "noopener,noreferrer");
    setSubmitNotice("Opening secure Brevo signup form in a new tab...");
    setSubmitTone("good");
  };

  return (
    <AppLayout>
      <main className="mx-auto max-w-md px-4 pb-28 pt-8">
        <div className="flex items-start justify-between gap-3 pb-5 pt-4">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-foreground">
              E-Mail Alerts
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Secure outage notifications via Brevo with captcha and double opt-in
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadConfig()}
            className="glass flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all active:scale-95"
            aria-label="Refresh subscription config"
          >
            <RefreshCw
              size={18}
              className={`text-muted-foreground transition-transform ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <section className="glass glass-specular rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary/15 to-transparent p-4">
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                  <ShieldCheck size={18} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-foreground">
                    Subscription Configuration
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{statusText(configResult)}</p>
                </div>
              </div>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${STATUS_CLASS[currentTone]}`}
              >
                {provider}
              </span>
            </div>
          </div>
        </section>

        <section className="glass glass-specular mt-4 rounded-2xl p-4">
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                <Mail size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Newsletter Signup</h2>
                <p className="text-[11px] text-muted-foreground">
                  Same `subscription.json` config as the current site
                </p>
              </div>
            </div>

            <form className="space-y-3" noValidate onSubmit={onSubmit}>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-foreground">
                  Enter your email address
                </span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/40"
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  inputMode="email"
                />
              </label>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Captcha and double opt-in are completed on the secure Brevo page after you continue.
              </p>

              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/25 bg-primary/15 px-4 text-sm font-semibold text-primary transition-all enabled:hover:bg-primary/20 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open Secure Signup
              </button>
            </form>

            <p className={`mt-3 rounded-xl border px-3 py-2 text-[11px] ${STATUS_CLASS[submitTone]}`}>
              {submitNotice}
            </p>
          </div>
        </section>

        <section className="mt-4 grid gap-4">
          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Config Details
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Provider
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{provider}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Host
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">
                    {formatHost(configResult?.parsedUrl || null)}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Source
                  </p>
                  <p className="mt-1 text-xs font-medium text-foreground">/data/subscription.json</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {checkedLabel.split(":")[0]}
                  </p>
                  <p className="mt-1 text-xs font-medium text-foreground">
                    {checkedLabel.replace(/^Check:\s*/, "")}
                  </p>
                </div>
              </div>
              {configResult?.message ? (
                <p className="mt-3 text-[11px] text-muted-foreground">{configResult.message}</p>
              ) : null}
            </div>
          </div>

          <div className="glass glass-specular rounded-2xl p-4">
            <div className="relative z-10 space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Fallback Links
              </h2>
              <a
                href={resolveLegacyPath("/email-alerts.html")}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/10"
              >
                <span>Open legacy embedded signup page</span>
                <ExternalLink size={14} className="text-muted-foreground" />
              </a>
              {configResult?.parsedUrl ? (
                <a
                  href={configResult.parsedUrl.toString()}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-white/10"
                >
                  <span>Open Brevo form directly</span>
                  <ExternalLink size={14} className="text-muted-foreground" />
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </AppLayout>
  );
};

export default EmailAlerts;
