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
import { cn } from "@/lib/utils";
import { pickLang, useAppShell } from "@/lib/appShell";
import { Bot, Loader2, MessageSquareText, RefreshCw, Send, TriangleAlert } from "lucide-react";
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
  const serviceName = serviceId ? serviceId.charAt(0).toUpperCase() + serviceId.slice(1) : "GitHub";

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
          content: pickLang(
            language,
            "AI unavailable right now. The normal status site still works, but the assistant could not be reached.",
            "Die KI ist gerade nicht verfügbar. Die normale Statusseite funktioniert weiter, aber der Assistent konnte nicht erreicht werden.",
          ),
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
          className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom,8px))] right-4 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-foreground shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
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
        className="border-white/10 bg-[#08101d]/95 p-0 text-foreground sm:max-w-[430px]"
      >
        <div className="flex h-full max-h-[92vh] flex-col">
          <SheetHeader className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <SheetTitle className="flex items-center gap-2 text-base">
                  <MessageSquareText size={16} />
                  {pickLang(language, "Status Assistant", "Status-Assistent")}
                </SheetTitle>
                <SheetDescription className="mt-1 text-xs">
                  {pickLang(
                    language,
                    "Grounded only in the site’s public status data.",
                    "Nur auf den öffentlichen Statusdaten der Seite basiert.",
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
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
                {pickLang(language, "Current page context:", "Aktueller Seitenkontext:")}{" "}
                <span className="font-semibold text-foreground">{routeServiceId}</span>
              </div>
            ) : null}
          </SheetHeader>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !assistantDraft ? (
              <div className="space-y-3">
                <div className="glass glass-specular rounded-2xl p-4">
                  <div className="relative z-10">
                    <p className="text-sm font-semibold text-foreground">
                      {pickLang(language, "Ask about status, incidents, or site usage.", "Frage nach Status, Vorfällen oder der Nutzung der Seite.")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {pickLang(
                        language,
                        "The assistant only uses the public JSON outputs already shown on the site.",
                        "Der Assistent nutzt nur die öffentlichen JSON-Ausgaben, die auf der Seite bereits verwendet werden.",
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInput(suggestion)}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm text-foreground transition-colors hover:bg-white/10"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div className="max-w-[92%]">
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 text-sm leading-6 shadow-[0_18px_40px_rgba(0,0,0,0.22)]",
                        message.role === "user"
                          ? "rounded-br-md bg-primary text-primary-foreground"
                          : "rounded-bl-md border border-white/10 bg-white/5 text-foreground",
                      )}
                    >
                      {message.content}
                    </div>

                    {message.role === "assistant" && message.citations && message.citations.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {message.citations.map((citation) => (
                          <a
                            key={`${message.id}-${citation.url}`}
                            href={citation.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                          >
                            {citation.title}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {assistantDraft ? (
                <div className="flex justify-start">
                  <div className="max-w-[92%]">
                    <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
                      {assistantDraft}
                      <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-full bg-primary/80 align-middle" />
                    </div>
                    {draftCitations.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {draftCitations.map((citation) => (
                          <span
                            key={`draft-${citation.url}`}
                            className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] text-muted-foreground"
                          >
                            {citation.title}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="border-t border-white/10 px-4 py-4">
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
                placeholder={pickLang(
                  language,
                  "Ask about current status, recent incidents, or how to use the site...",
                  "Frage nach aktuellem Status, letzten Vorfällen oder der Nutzung der Seite...",
                )}
                disabled={availability !== "available" || sending}
                className="min-h-[92px] w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  {pickLang(
                    language,
                    "Answers are based on public status JSON only.",
                    "Antworten basieren nur auf öffentlichen Status-JSON-Daten.",
                  )}
                </p>
                <Button
                  type="submit"
                  disabled={availability !== "available" || sending || !input.trim()}
                  className="rounded-full px-4"
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
