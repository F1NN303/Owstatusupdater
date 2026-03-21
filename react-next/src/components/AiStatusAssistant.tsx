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
    return "Overview";
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
  if (!serviceId) {
    if (language === "de") {
      return [
        "Gibt es gerade bei überwachten Diensten Probleme?",
        "Was zeigt die Seite aktuell?",
        "Wobei kann mir dieser Assistent helfen?",
      ];
    }

    return [
      "Are any monitored services currently having problems?",
      "What is the site showing right now?",
      "What can this assistant help me with?",
    ];
  }

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

function publicDataLabel(language: "en" | "de") {
  return pickLang(language, "Public data only", "Nur öffentliche Daten");
}

function publicDataDescription(language: "en" | "de") {
  return pickLang(
    language,
    "Uses public status JSON and public site help only.",
    "Nutzt nur öffentliche Status-JSON-Daten und öffentliche Seitenhilfen.",
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="h-1.5 w-1.5 rounded-full bg-cyan-300 motion-safe:animate-[ai-dot_1.1s_ease-in-out_infinite]"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
    </span>
  );
}

const AiStatusAssistant = () => {
  const { language } = useAppShell();
  const location = useLocation();
  const isMobile = useIsMobile();
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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
  const [keyboardInset, setKeyboardInset] = useState(0);

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
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 56), 164)}px`;
  }, [input]);

  useEffect(() => {
    if (!open || availability !== "available") {
      return;
    }

    const timeout = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 160);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [open, availability]);

  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.visualViewport) {
      setKeyboardInset(0);
      return;
    }

    const viewport = window.visualViewport;

    const updateKeyboardInset = () => {
      const overlap = Math.max(0, window.innerHeight - Math.round(viewport.height + viewport.offsetTop));
      setKeyboardInset(overlap > 20 ? overlap : 0);
    };

    updateKeyboardInset();
    viewport.addEventListener("resize", updateKeyboardInset);
    viewport.addEventListener("scroll", updateKeyboardInset);

    return () => {
      viewport.removeEventListener("resize", updateKeyboardInset);
      viewport.removeEventListener("scroll", updateKeyboardInset);
      setKeyboardInset(0);
    };
  }, [open]);

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

  function handleSuggestionSelect(suggestion: string) {
    setInput(suggestion);
    textareaRef.current?.focus();
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
          className="fixed bottom-[calc(6.25rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex items-center gap-2 rounded-full border border-cyan-300/15 bg-slate-950/82 px-4 py-3 text-sm font-semibold text-foreground shadow-[0_18px_46px_rgba(2,8,23,0.48)] backdrop-blur-xl transition-transform duration-300 hover:scale-[1.015] active:scale-[0.985] sm:bottom-6 sm:right-6"
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
        className="h-[min(88dvh,860px)] rounded-t-[30px] border-x border-t border-cyan-300/10 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.1),_transparent_28%),radial-gradient(circle_at_85%_12%,_rgba(59,130,246,0.12),_transparent_24%),linear-gradient(180deg,_rgba(4,9,20,0.98),_rgba(6,12,24,0.98))] p-0 text-foreground shadow-[0_-24px_70px_rgba(2,8,23,0.56)] motion-safe:data-[state=open]:animate-[ai-sheet-rise_320ms_cubic-bezier(0.22,1,0.36,1)] sm:h-full sm:max-w-[430px] sm:rounded-none sm:border-x-0 sm:border-t-0 sm:border-l sm:shadow-[-18px_0_70px_rgba(2,8,23,0.36)]"
      >
        <div className="flex h-full min-h-0 max-h-[100dvh] flex-col">
          {isMobile ? <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-white/15" /> : null}

          <SheetHeader className="border-b border-white/8 px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-2 text-[15px] font-semibold sm:text-[17px]">
                  <MessageSquareText size={16} className="text-cyan-100/90" />
                  {pickLang(language, "Status Assistant", "Status-Assistent")}
                </SheetTitle>
                <SheetDescription className="mt-1 max-w-[28rem] text-[12px] leading-5 text-slate-400">
                  {pickLang(
                    language,
                    "Answers from public status data and public site help only.",
                    "Antworten nur aus öffentlichen Statusdaten und öffentlichen Seitenhilfen.",
                  )}
                </SheetDescription>
              </div>
              <div
                className={cn(
                  "min-w-[112px] whitespace-nowrap rounded-full border px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em]",
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
              <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-cyan-300/12 bg-cyan-300/6 px-3 py-1.5 text-[11px] text-slate-300">
                <ShieldCheck size={14} className="shrink-0 text-cyan-300" />
                <span>
                  {pickLang(language, "Context", "Kontext")}{" "}
                  <span className="font-semibold text-slate-50">{prettifyServiceId(routeServiceId)}</span>
                </span>
              </div>
            ) : null}
          </SheetHeader>

          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {messages.length === 0 && !assistantDraft ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(10,16,30,0.92))] p-5 shadow-[0_24px_60px_rgba(2,8,23,0.34)]">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/90">
                      <Sparkles size={12} />
                      {publicDataLabel(language)}
                    </div>
                    <p className="max-w-[18rem] text-[20px] font-semibold leading-[1.15] text-slate-50">
                      {pickLang(
                        language,
                        "Ask what matters right now.",
                        "Frage nach dem, was jetzt wichtig ist.",
                      )}
                    </p>
                    <p className="max-w-[22rem] text-[13px] leading-6 text-slate-300">
                      {pickLang(
                        language,
                        "Status, incidents, history, and help are summarized from the same public data already used on this site.",
                        "Status, Vorfälle, Verlauf und Hilfetexte werden aus denselben öffentlichen Daten zusammengefasst, die diese Seite bereits nutzt.",
                      )}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2.5">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className="group rounded-[22px] border border-white/8 bg-white/[0.045] px-4 py-3.5 text-left text-[14px] text-slate-100 transition-all duration-200 hover:border-cyan-300/20 hover:bg-cyan-300/[0.06] hover:shadow-[0_12px_28px_rgba(8,47,73,0.2)]"
                    >
                      <span className="block leading-6">{suggestion}</span>
                      <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-cyan-200/75 transition-transform duration-200 group-hover:translate-x-0.5">
                        {pickLang(language, "Use prompt", "Frage einsetzen")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex motion-safe:animate-[ai-message-in_240ms_cubic-bezier(0.22,1,0.36,1)]",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div className="max-w-full sm:max-w-[90%]">
                    <div
                      className={cn(
                        "overflow-hidden rounded-[24px] px-4 py-3.5 text-sm shadow-[0_18px_40px_rgba(0,0,0,0.2)]",
                        message.role === "user"
                          ? "rounded-br-md bg-[linear-gradient(135deg,_rgba(13,148,136,0.96),_rgba(14,116,144,0.94))] text-primary-foreground"
                          : "rounded-bl-md border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(10,16,30,0.94))] text-foreground",
                      )}
                    >
                      {message.role === "assistant" ? (
                        <div className="space-y-3">
                          <AiFormattedMessage content={message.content} />
                        </div>
                      ) : (
                        <p className="break-words text-[15px] leading-7">{message.content}</p>
                      )}
                    </div>

                    {message.role === "assistant" && message.citations && message.citations.length > 0 ? (
                      <div className="mt-3 space-y-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {pickLang(language, "Sources", "Quellen")}
                        </p>
                        {message.citations.map((citation) => (
                          <a
                            key={`${message.id}-${citation.url}`}
                            href={citation.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-slate-950/35 px-3.5 py-2.5 text-left text-xs text-slate-200 transition-all duration-200 hover:border-cyan-300/25 hover:bg-white/[0.08]"
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
                <div className="flex justify-start motion-safe:animate-[ai-message-in_220ms_cubic-bezier(0.22,1,0.36,1)]">
                  <div className="max-w-full sm:max-w-[90%]">
                    <div className="rounded-[24px] rounded-bl-md border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(10,16,30,0.94))] px-4 py-3.5 text-sm text-foreground shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/10 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                        <TypingDots />
                        {pickLang(language, "Answer in progress", "Antwort läuft")}
                      </div>
                      <AiFormattedMessage content={assistantDraft} />
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                        <TypingDots />
                        {pickLang(language, "Live response", "Live-Antwort")}
                      </div>
                    </div>
                    {draftCitations.length > 0 ? (
                      <div className="mt-3 space-y-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {pickLang(language, "Sources", "Quellen")}
                        </p>
                        {draftCitations.map((citation) => (
                          <span
                            key={`draft-${citation.url}`}
                            className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-slate-950/35 px-3.5 py-2.5 text-xs text-slate-300"
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

          <div
            className="border-t border-white/8 bg-[linear-gradient(180deg,rgba(4,10,20,0.72),rgba(4,10,20,0.96))] px-4 pt-4 sm:px-6"
            style={{
              paddingBottom: `calc(1rem + env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`,
            }}
          >
            {availability !== "available" ? (
              <div className="mb-3 rounded-[22px] border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-xs text-amber-100">
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
              <div className="rounded-[26px] border border-white/8 bg-slate-950/55 p-2 shadow-[0_16px_36px_rgba(2,8,23,0.24)]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  maxLength={600}
                  placeholder={pickLang(
                    language,
                    "Ask about current status, recent incidents, or how to use the site...",
                    "Frage nach aktuellem Status, letzten Vorfällen oder der Nutzung der Seite...",
                  )}
                  disabled={availability !== "available" || sending}
                  className="min-h-[56px] w-full resize-none bg-transparent px-3.5 pb-2 pt-2.5 text-[15px] leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
                <div className="flex items-end justify-between gap-3 border-t border-white/6 px-2 pt-2">
                  <div className="pr-2">
                    <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                      {publicDataLabel(language)}
                    </p>
                    <p className="mt-1 max-w-[14rem] text-[11px] leading-5 text-slate-400">
                      {publicDataDescription(language)}
                    </p>
                  </div>
                  <Button
                    type="submit"
                    disabled={availability !== "available" || sending || !input.trim()}
                    className="h-11 rounded-full bg-[linear-gradient(135deg,_rgba(20,184,166,0.96),_rgba(2,132,199,0.96))] px-5 text-primary-foreground shadow-[0_10px_28px_rgba(6,78,99,0.34)] transition-transform duration-200 hover:translate-y-[-1px] hover:brightness-105 disabled:bg-slate-700 disabled:text-slate-300"
                  >
                    {sending ? <Loader2 className="animate-spin" /> : <Send size={14} />}
                    {pickLang(language, "Send", "Senden")}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 px-1">
                <p className="text-[11px] leading-5 text-slate-500">
                  {pickLang(
                    language,
                    "If the assistant is offline, the normal status site still works.",
                    "Wenn der Assistent offline ist, funktioniert die normale Statusseite weiter.",
                  )}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMessages([]);
                    setAssistantDraft("");
                    setDraftCitations([]);
                    setInput("");
                  }}
                  className="h-8 rounded-full px-3 text-[11px] text-slate-400 hover:bg-white/5 hover:text-slate-200"
                >
                  {pickLang(language, "Clear", "Leeren")}
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
