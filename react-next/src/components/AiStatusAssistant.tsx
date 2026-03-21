import AiFormattedMessage from "@/components/AiFormattedMessage";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  askStatusStream,
  checkAiAvailability,
  isAiConfigured,
  type AiCitation,
  type AiChatHistoryEntry,
} from "@/lib/aiStatusChat";
import { pickLang, useAppShell } from "@/lib/appShell";
import { cn } from "@/lib/utils";
import {
  Bot,
  ExternalLink,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: AiCitation[];
}

type AvailabilityState = "checking" | "available" | "unavailable";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveServiceIdFromPathname(pathname: string) {
  const match = pathname.match(/\/status\/([^/?#]+)/i);
  return match?.[1]?.toLowerCase() || null;
}

function prettifyServiceId(value: string | null) {
  if (!value) {
    return "GitHub";
  }

  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function availabilityLabel(language: "en" | "de", state: AvailabilityState, configured: boolean) {
  if (!configured) {
    return pickLang(language, "AI unavailable", "KI nicht verfügbar");
  }
  if (state === "checking") {
    return pickLang(language, "Checking AI", "Prüfe KI");
  }
  if (state === "available") {
    return pickLang(language, "AI online", "KI online");
  }
  return pickLang(language, "AI unavailable", "KI nicht verfügbar");
}

function availabilityReasonText(language: "en" | "de", configured: boolean, reason?: string) {
  if (!configured) {
    return pickLang(
      language,
      "The AI endpoint is not configured for this build yet.",
      "Der KI-Endpunkt ist für diesen Build noch nicht konfiguriert.",
    );
  }

  if (reason === "backend-degraded") {
    return pickLang(
      language,
      "The AI backend is reachable but not healthy right now.",
      "Das KI-Backend ist erreichbar, aber aktuell nicht gesund.",
    );
  }

  if (reason === "network") {
    return pickLang(
      language,
      "The AI backend could not be reached from your browser.",
      "Das KI-Backend konnte aus deinem Browser nicht erreicht werden.",
    );
  }

  return pickLang(
    language,
    "The AI backend is currently unavailable.",
    "Das KI-Backend ist derzeit nicht verfügbar.",
  );
}

function buildSuggestions(language: "en" | "de", serviceId: string | null) {
  const serviceName = prettifyServiceId(serviceId);

  if (language === "de") {
    return [
      `Gibt es bei ${serviceName} gerade Probleme?`,
      "Welche aktuellen Vorfälle sollte ich kennen?",
      "Wie benutze ich diese Statusseite richtig?",
    ];
  }

  return [
    `Is ${serviceName} currently having problems?`,
    "What recent incidents should I know about?",
    "How should I use this status site?",
  ];
}

function resolveAssistantFailureMessage(language: "en" | "de", error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("rate limit")) {
    return pickLang(
      language,
      "The assistant is busy right now. Please wait a moment and try again.",
      "Der Assistent ist gerade ausgelastet. Bitte warte kurz und versuche es erneut.",
    );
  }

  return pickLang(
    language,
    "AI unavailable right now. The normal status site still works, but the assistant could not be reached.",
    "Die KI ist gerade nicht verfügbar. Die normale Statusseite funktioniert weiter, aber der Assistent konnte nicht erreicht werden.",
  );
}

const AiStatusAssistant = () => {
  const { language } = useAppShell();
  const location = useLocation();
  const isMobile = useIsMobile();
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const activeRequestRef = useRef<AbortController | null>(null);
  const configured = isAiConfigured();
  const routeServiceId = resolveServiceIdFromPathname(location.pathname);
  const suggestions = useMemo(() => buildSuggestions(language, routeServiceId), [language, routeServiceId]);

  const [open, setOpen] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityState>("checking");
  const [availabilityReason, setAvailabilityReason] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState("");
  const [draftCitations, setDraftCitations] = useState<AiCitation[]>([]);

  useEffect(() => {
    let active = true;

    void (async () => {
      const next = await checkAiAvailability();
      if (!active) {
        return;
      }

      setAvailability(next.available ? "available" : "unavailable");
      setAvailabilityReason(next.reason);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!chatScrollRef.current) {
      return;
    }
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, assistantDraft, open]);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
    };
  }, []);

  async function refreshAvailability() {
    setAvailability("checking");
    const next = await checkAiAvailability();
    setAvailability(next.available ? "available" : "unavailable");
    setAvailabilityReason(next.reason);
    return next;
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    const trimmedInput = input.trim();
    if (!trimmedInput || sending) {
      return;
    }

    if (availability !== "available") {
      const next = await refreshAvailability();
      if (!next.available) {
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: makeId("user"),
      role: "user",
      content: trimmedInput,
    };
    const history: AiChatHistoryEntry[] = [...messages, userMessage]
      .slice(-8)
      .map((entry) => ({
        role: entry.role,
        content: entry.content,
      }));

    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;

    let nextContent = "";
    let nextCitations: AiCitation[] = [];

    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setAssistantDraft("");
    setDraftCitations([]);
    setSending(true);

    try {
      await askStatusStream(
        {
          message: trimmedInput,
          history,
          language,
          serviceId: routeServiceId,
          pagePath: location.pathname,
          signal: controller.signal,
        },
        {
          onContext: (context) => {
            nextCitations = Array.isArray(context.citations) ? context.citations : [];
            setDraftCitations(nextCitations);
          },
          onDelta: (delta) => {
            nextContent += delta;
            setAssistantDraft(nextContent);
          },
        },
      );

      const finalContent = nextContent.trim()
        ? nextContent.trim()
        : pickLang(
            language,
            "The AI did not return a visible answer this time. Please try again.",
            "Die KI hat diesmal keine sichtbare Antwort zurückgegeben. Bitte versuche es erneut.",
          );

      setMessages((previous) => [
        ...previous,
        {
          id: makeId("assistant"),
          role: "assistant",
          content: finalContent,
          citations: nextCitations,
        },
      ]);
      setAssistantDraft("");
      setDraftCitations([]);
      setAvailability("available");
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      setAvailability("unavailable");
      setAvailabilityReason("network");
      setAssistantDraft("");
      setDraftCitations([]);
      setMessages((previous) => [
        ...previous,
        {
          id: makeId("assistant"),
          role: "assistant",
          content: resolveAssistantFailureMessage(language, error),
        },
      ]);
    } finally {
      setSending(false);
      activeRequestRef.current = null;
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom,8px))] right-4 z-40 flex items-center gap-2 rounded-full border border-cyan-400/15 bg-slate-950/80 px-4 py-3 text-sm font-semibold text-foreground shadow-[0_20px_60px_rgba(2,8,23,0.48)] backdrop-blur-xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              availability === "available" ? "bg-emerald-400" : availability === "checking" ? "bg-amber-300" : "bg-slate-500",
            )}
          />
          <Bot size={16} />
          <span>{pickLang(language, "Ask AI", "KI fragen")}</span>
        </button>
      </SheetTrigger>

      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="h-[calc(100dvh-0.75rem)] border-x border-t border-cyan-400/10 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_34%),linear-gradient(180deg,_rgba(7,12,24,0.98),_rgba(5,10,20,0.98))] p-0 text-foreground sm:h-full sm:max-w-[460px] sm:border-x-0 sm:border-t-0 sm:border-l"
      >
        <div className="flex h-full max-h-[100dvh] flex-col">
          <SheetHeader className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <MessageSquareText size={16} />
                  {pickLang(language, "Status Assistant", "Status-Assistent")}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs leading-5">
                  {pickLang(
                    language,
                    "Grounded only in the site’s public status data. No private/admin data.",
                    "Nur auf den öffentlichen Statusdaten der Seite basiert. Keine privaten Admin-Daten.",
                  )}
                </SheetDescription>
              </div>
              <div
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
                  availability === "available"
                    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-300"
                    : availability === "checking"
                      ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                      : "border-white/10 bg-white/5 text-muted-foreground",
                )}
              >
                {availabilityLabel(language, availability, configured)}
              </div>
            </div>

            {routeServiceId ? (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-cyan-400/10 bg-cyan-400/5 px-3 py-2 text-xs text-slate-300">
                <ShieldCheck size={14} className="shrink-0 text-cyan-300" />
                <span>
                  {pickLang(language, "Current page context:", "Aktueller Seitenkontext:")}{" "}
                  <span className="font-semibold text-slate-50">{prettifyServiceId(routeServiceId)}</span>
                </span>
              </div>
            ) : null}
          </SheetHeader>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {messages.length === 0 && !assistantDraft ? (
              <div className="space-y-4">
                <div className="rounded-[24px] border border-cyan-400/10 bg-slate-900/60 p-4 shadow-[0_18px_50px_rgba(2,8,23,0.32)]">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
                      <Sparkles size={12} />
                      {pickLang(language, "Grounded answers", "Geerdete Antworten")}
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {pickLang(language, "Ask about status, incidents, or site usage.", "Frage nach Status, Vorfällen oder der Nutzung der Seite.")}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {pickLang(
                        language,
                        "The assistant only summarizes the public JSON and site content already visible here.",
                        "Der Assistent fasst nur die öffentlichen JSON-Daten und Seiteninhalte zusammen, die hier bereits sichtbar sind.",
                      )}
                    </p>
                  </div>
                </div>

                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInput(suggestion)}
                      className="min-w-[220px] rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-white/10"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div className="max-w-full sm:max-w-[92%]">
                    <div
                      className={cn(
                        "overflow-hidden rounded-[24px] px-4 py-3 text-sm shadow-[0_18px_40px_rgba(0,0,0,0.22)]",
                        message.role === "user"
                          ? "rounded-br-md bg-[linear-gradient(135deg,_rgba(14,165,233,0.95),_rgba(37,99,235,0.92))] text-primary-foreground"
                          : "rounded-bl-md border border-cyan-400/10 bg-slate-900/65 text-foreground",
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="space-y-3">
                          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/10 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                            <ShieldCheck size={12} />
                            {pickLang(language, "Grounded answer", "Geerdete Antwort")}
                          </div>
                          <AiFormattedMessage content={message.content} />
                        </div>
                      ) : (
                        <p className="break-words text-[14px] leading-6">{message.content}</p>
                      )}
                    </div>

                    {message.role === "assistant" && message.citations && message.citations.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {pickLang(language, "Sources", "Quellen")}
                        </p>
                        {message.citations.map((citation) => (
                          <a
                            key={`${message.id}-${citation.url}`}
                            href={citation.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-left text-xs text-slate-200 transition-colors hover:border-cyan-300/25 hover:bg-white/10"
                          >
                            <span className="min-w-0 break-words font-medium">{citation.title}</span>
                            <ExternalLink size={14} className="shrink-0 text-slate-400" />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {assistantDraft ? (
                <div className="flex justify-start">
                  <div className="max-w-full sm:max-w-[92%]">
                    <div className="rounded-[24px] rounded-bl-md border border-cyan-400/10 bg-slate-900/65 px-4 py-3 text-sm text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/10 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                        <Sparkles size={12} />
                        {pickLang(language, "Preparing answer", "Antwort wird erstellt")}
                      </div>
                      <AiFormattedMessage content={assistantDraft} />
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                        {pickLang(language, "Streaming grounded reply", "Geerdete Antwort wird übertragen")}
                      </div>
                    </div>
                    {draftCitations.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {pickLang(language, "Sources", "Quellen")}
                        </p>
                        {draftCitations.map((citation) => (
                          <span
                            key={`draft-${citation.url}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-slate-300"
                          >
                            <span>{citation.title}</span>
                            <ExternalLink size={14} className="shrink-0 text-slate-500" />
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-white/10 bg-slate-950/35 px-4 py-4 sm:px-5">
            {availability !== "available" ? (
              <div className="mb-3 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-xs text-amber-100">
                <div className="flex items-start gap-2">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {pickLang(language, "AI unavailable", "KI nicht verfügbar")}
                    </p>
                    <p className="mt-1 opacity-90">
                      {availabilityReasonText(language, configured, availabilityReason)}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void refreshAvailability()}
                  className="mt-3 h-8 rounded-full bg-black/30 px-3 text-xs"
                >
                  <RefreshCw size={13} />
                  {pickLang(language, "Retry", "Erneut prüfen")}
                </Button>
              </div>
            ) : null}

            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                maxLength={600}
                placeholder={pickLang(
                  language,
                  "Ask about current status, recent incidents, or how to use the site...",
                  "Frage nach aktuellem Status, letzten Vorfällen oder der Nutzung der Seite...",
                )}
                disabled={availability !== "available" || sending}
                className="min-h-[108px] w-full resize-none rounded-[22px] border border-white/10 bg-slate-900/65 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-cyan-300/35 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="flex items-end justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {pickLang(language, "Public-data mode", "Öffentlicher-Daten-Modus")}
                  </p>
                  <p className="max-w-[220px] text-[11px] leading-5 text-muted-foreground">
                    {pickLang(
                      language,
                      "Answers stay grounded in public status JSON and public site help content only.",
                      "Antworten bleiben nur auf öffentlichen Status-JSON-Daten und öffentlichen Seitenhilfen geerdet.",
                    )}
                  </p>
                </div>
                <Button
                  type="submit"
                  disabled={availability !== "available" || sending || !input.trim()}
                  className="h-11 rounded-full px-5"
                >
                  {sending ? <Loader2 className="animate-spin" /> : <Send size={14} />}
                  {pickLang(language, "Send", "Senden")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AiStatusAssistant;
