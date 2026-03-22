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
    "Public status JSON and public site help.",
    "Öffentliche Status-JSON-Daten und öffentliche Seitenhilfen.",
  );
}

function introHeading(language: "en" | "de") {
  return pickLang(language, "Ask what matters now.", "Frage nach dem, was jetzt wichtig ist.");
}

function introBody(language: "en" | "de") {
  return pickLang(
    language,
    "Ask about status, incidents, history, or how to use the site. Answers stay tied to the same public data shown here.",
    "Frage nach Status, Vorfällen, Verlauf oder der Nutzung der Seite. Antworten bleiben an dieselben öffentlichen Daten gebunden, die hier gezeigt werden.",
  );
}

function introSuggestionLabel(language: "en" | "de") {
  return pickLang(language, "Try one of these", "Probiere zum Start");
}

function inputPlaceholder(language: "en" | "de") {
  return pickLang(
    language,
    "Ask about current status, recent incidents, or how to use the site...",
    "Frage nach aktuellem Status, letzten Vorfällen oder der Nutzung der Seite...",
  );
}

function emptyResponseText(language: "en" | "de") {
  return pickLang(
    language,
    "The AI did not return a visible answer this time. Please try again.",
    "Die KI hat diesmal keine sichtbare Antwort zurückgegeben. Bitte versuche es erneut.",
  );
}

function footerNote(language: "en" | "de") {
  return pickLang(
    language,
    "The normal status site keeps working if the assistant is offline.",
    "Die normale Statusseite funktioniert weiter, auch wenn der Assistent offline ist.",
  );
}

function liveAnswerLabel(language: "en" | "de") {
  return pickLang(language, "Live response", "Live-Antwort");
}

function contextLabel(language: "en" | "de") {
  return pickLang(language, "Context", "Kontext");
}

function sourcesLabel(language: "en" | "de") {
  return pickLang(language, "Sources", "Quellen");
}

function citationHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
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

function CitationList({
  citations,
  language,
  pending = false,
}: {
  citations: AiCitation[];
  language: "en" | "de";
  pending?: boolean;
}) {
  if (!citations.length) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2.5">
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {sourcesLabel(language)}
      </p>
      <div className="grid gap-2">
        {citations.map((citation) => {
          const host = citationHost(citation.url);
          const content = (
            <>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-slate-100">{citation.title}</p>
                {host ? <p className="mt-1 text-[11px] text-slate-500">{host}</p> : null}
              </div>
              <ExternalLink size={14} className="shrink-0 text-slate-500" />
            </>
          );

          const className =
            "flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3.5 py-3 text-left transition-all duration-200";

          if (pending) {
            return (
              <span key={`draft-${citation.url}`} className={cn(className, "text-slate-300")}>
                {content}
              </span>
            );
          }

          return (
            <a
              key={citation.url}
              href={citation.url}
              target="_blank"
              rel="noreferrer"
              aria-label={citation.title}
              className={cn(className, "hover:border-cyan-300/20 hover:bg-cyan-300/[0.05]")}
            >
              {content}
            </a>
          );
        })}
      </div>
    </div>
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

  const hasConversation = messages.length > 0 || Boolean(assistantDraft);
  const composerDisabled = availability !== "available" || sending;
  const canClear = messages.length > 0 && !sending && !assistantDraft;

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
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 70), 180)}px`;
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

  function clearConversation() {
    setMessages([]);
    setAssistantDraft("");
    setDraftCitations([]);
    setInput("");
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

      const finalContent = nextContent.trim() ? nextContent.trim() : emptyResponseText(language);

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
          className="fixed bottom-[calc(6.1rem+env(safe-area-inset-bottom,0px))] right-4 z-40 flex items-center gap-2.5 rounded-full border border-white/10 bg-slate-950/78 px-4 py-3 text-sm font-medium text-foreground shadow-[0_18px_46px_rgba(2,8,23,0.42)] backdrop-blur-xl transition-all duration-300 hover:border-cyan-300/20 hover:bg-slate-900/86 hover:shadow-[0_20px_54px_rgba(2,8,23,0.5)] active:scale-[0.985] sm:bottom-6 sm:right-6"
        >
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor]",
              availability === "available"
                ? "bg-emerald-400 text-emerald-400"
                : availability === "checking"
                  ? "bg-amber-300 text-amber-300"
                  : "bg-slate-500 text-slate-500",
            )}
          />
          <Bot size={16} className="text-cyan-100" />
          <span>{pickLang(language, "Ask AI", "KI fragen")}</span>
        </button>
      </SheetTrigger>

      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="h-[min(84dvh,860px)] overflow-hidden rounded-t-[32px] border-x border-t border-white/10 bg-[linear-gradient(180deg,rgba(5,11,22,0.98),rgba(5,11,22,0.94))] p-0 text-foreground shadow-[0_-28px_72px_rgba(2,8,23,0.58)] motion-safe:data-[state=open]:animate-[ai-sheet-rise_340ms_cubic-bezier(0.22,1,0.36,1)] sm:h-full sm:max-w-[420px] sm:rounded-none sm:border-x-0 sm:border-t-0 sm:border-l sm:shadow-[-16px_0_58px_rgba(2,8,23,0.36)] [&>button]:right-4 [&>button]:top-4 [&>button]:rounded-full [&>button]:border [&>button]:border-white/10 [&>button]:bg-white/[0.04] [&>button]:p-1.5 [&>button]:text-slate-400 [&>button]:transition-colors [&>button:hover]:bg-white/[0.08] [&>button:hover]:text-slate-100 [&>button_svg]:h-4 [&>button_svg]:w-4"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-14%] top-[-6%] h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl motion-safe:animate-[ai-aura_16s_ease-in-out_infinite]" />
          <div className="absolute bottom-[12%] right-[-18%] h-56 w-56 rounded-full bg-emerald-400/8 blur-3xl motion-safe:animate-[ai-aura_18s_ease-in-out_infinite_reverse]" />
          <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
        </div>

        <div className="relative flex h-full min-h-0 max-h-[100dvh] flex-col">
          {isMobile ? <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-white/15" /> : null}

          <SheetHeader className="border-b border-white/8 px-5 pb-3 pt-4 text-left sm:px-6 sm:pb-3 sm:pt-5">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <MessageSquareText size={15} className="shrink-0 text-cyan-100/85" />
                  <div className="min-w-0">
                    <SheetTitle className="text-[15px] font-semibold tracking-[-0.01em] sm:text-[17px]">
                      {pickLang(language, "Status Assistant", "Status-Assistent")}
                    </SheetTitle>
                    <SheetDescription className="mt-0.5 text-[11px] leading-5 text-slate-400">
                      {publicDataDescription(language)}
                    </SheetDescription>
                  </div>
                </div>

                {routeServiceId ? (
                  <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-slate-300">
                    <ShieldCheck size={14} className="shrink-0 text-cyan-300" />
                    <span>
                      {contextLabel(language)}{" "}
                      <span className="font-semibold text-slate-50">{prettifyServiceId(routeServiceId)}</span>
                    </span>
                  </div>
                ) : null}
              </div>

              <div
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]",
                  availability === "available"
                    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-300"
                    : availability === "checking"
                      ? "border-amber-300/25 bg-amber-300/10 text-amber-200"
                      : "border-white/10 bg-white/[0.05] text-muted-foreground",
                )}
              >
                {availabilityLabel(language, availability, configured)}
              </div>
            </div>
          </SheetHeader>

          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5"
            style={{ WebkitOverflowScrolling: "touch", scrollPaddingBottom: "7rem" }}
          >
            {!hasConversation ? (
              <div className="mx-auto max-w-[22rem] space-y-4">
                <section className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(12,20,38,0.92),rgba(8,14,27,0.96))] px-4 pb-5 pt-4 shadow-[0_20px_60px_rgba(2,8,23,0.26)]">
                  <div className="absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_72%)]" />
                  <div className="relative space-y-3.5">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100/90">
                      <Sparkles size={12} />
                      {publicDataLabel(language)}
                    </div>

                    <div className="space-y-2.5">
                      <p className="max-w-[12rem] text-[24px] font-semibold leading-[1.02] tracking-[-0.045em] text-slate-50">
                        {introHeading(language)}
                      </p>
                      <p className="max-w-[18rem] text-[13px] leading-5 text-slate-300">{introBody(language)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {routeServiceId ? (
                        <span className="rounded-full border border-cyan-300/12 bg-cyan-300/[0.08] px-3 py-1.5 text-[11px] text-cyan-100">
                          {prettifyServiceId(routeServiceId)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {introSuggestionLabel(language)}
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => handleSuggestionSelect(suggestion)}
                        className="rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-left text-[13px] leading-5 text-slate-100 transition-all duration-200 hover:border-cyan-300/20 hover:bg-cyan-300/[0.05] hover:text-white motion-safe:animate-[ai-message-in_220ms_cubic-bezier(0.22,1,0.36,1)]"
                        style={{ animationDelay: `${index * 55}ms` }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </section>
              </div>
            ) : null}

            <div className={cn("space-y-4", !hasConversation && "mt-6")}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex motion-safe:animate-[ai-message-in_240ms_cubic-bezier(0.22,1,0.36,1)]",
                    message.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  <div className="max-w-[88%] sm:max-w-[86%]">
                    <div
                      className={cn(
                        "overflow-hidden rounded-[24px] px-4 py-3.5 shadow-[0_18px_42px_rgba(0,0,0,0.18)]",
                        message.role === "user"
                          ? "rounded-br-[10px] bg-[linear-gradient(135deg,rgba(8,145,178,0.96),rgba(13,148,136,0.94))] text-primary-foreground"
                          : "rounded-bl-[10px] border border-white/8 bg-[linear-gradient(180deg,rgba(13,20,37,0.92),rgba(9,15,28,0.94))] text-foreground",
                      )}
                    >
                      {message.role === "assistant" ? (
                        <AiFormattedMessage content={message.content} />
                      ) : (
                        <p className="break-words text-[15px] leading-7">{message.content}</p>
                      )}
                    </div>

                    {message.role === "assistant" && message.citations && message.citations.length > 0 ? (
                      <CitationList citations={message.citations} language={language} />
                    ) : null}
                  </div>
                </div>
              ))}

              {assistantDraft ? (
                <div className="flex justify-start motion-safe:animate-[ai-message-in_220ms_cubic-bezier(0.22,1,0.36,1)]">
                  <div className="max-w-[88%] sm:max-w-[86%]">
                    <div className="rounded-[24px] rounded-bl-[10px] border border-white/8 bg-[linear-gradient(180deg,rgba(13,20,37,0.92),rgba(9,15,28,0.94))] px-4 py-3.5 text-sm text-foreground shadow-[0_18px_42px_rgba(0,0,0,0.18)]">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/10 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                        <TypingDots />
                        {liveAnswerLabel(language)}
                      </div>
                      <AiFormattedMessage content={assistantDraft} />
                    </div>

                    <CitationList citations={draftCitations} language={language} pending />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="border-t border-white/8 bg-[linear-gradient(180deg,rgba(4,10,20,0.72),rgba(4,10,20,0.96))] px-4 pt-3 sm:px-6 sm:pt-4"
            style={{
              paddingBottom: `calc(1rem + env(safe-area-inset-bottom, 0px) + ${keyboardInset}px)`,
            }}
          >
            {availability !== "available" ? (
              <div className="mb-3 rounded-[22px] border border-amber-300/20 bg-amber-300/10 px-3 py-3 text-xs text-amber-100">
                <div className="flex items-start gap-2">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold">{pickLang(language, "AI unavailable", "KI nicht verfügbar")}</p>
                    <p className="mt-1 leading-5 opacity-90">
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

            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-2.5">
              <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,14,26,0.92),rgba(5,10,20,0.96))] p-3 shadow-[0_18px_42px_rgba(2,8,23,0.24)]">
                <div className="flex items-start gap-3">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    maxLength={600}
                    placeholder={inputPlaceholder(language)}
                    disabled={composerDisabled}
                    className="min-h-[62px] flex-1 resize-none bg-transparent px-1 py-1 text-[15px] leading-7 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <Button
                    type="submit"
                    disabled={composerDisabled || !input.trim()}
                    className="mt-1 h-10 w-10 shrink-0 rounded-full bg-[linear-gradient(135deg,rgba(20,184,166,0.98),rgba(3,105,161,0.98))] p-0 text-primary-foreground shadow-[0_14px_28px_rgba(8,47,73,0.34)] transition-all duration-200 hover:translate-y-[-1px] hover:brightness-105 disabled:bg-slate-700 disabled:text-slate-300"
                  >
                    {sending ? <Loader2 className="animate-spin" /> : <Send size={16} />}
                    <span className="sr-only">{pickLang(language, "Send", "Senden")}</span>
                  </Button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/8 pt-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {publicDataLabel(language)}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-400">{publicDataDescription(language)}</p>
                  </div>

                  {canClear ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearConversation}
                      className="h-8 rounded-full px-3 text-[11px] text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    >
                      {pickLang(language, "Clear", "Leeren")}
                    </Button>
                  ) : (
                    <span className="shrink-0 text-[11px] text-slate-500">
                      {input.trim() ? `${input.trim().length}/600` : ""}
                    </span>
                  )}
                </div>
              </div>

              {availability !== "available" ? (
                <p className="px-1 text-[11px] leading-5 text-slate-500">{footerNote(language)}</p>
              ) : null}
            </form>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AiStatusAssistant;
