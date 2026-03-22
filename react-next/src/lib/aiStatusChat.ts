import { safeExternalHref } from "@/lib/safeUrl";

export type AiChatRole = "user" | "assistant";

export interface AiChatHistoryEntry {
  role: AiChatRole;
  content: string;
}

export interface AiCitation {
  title: string;
  url: string;
}

export interface AiContextChunk {
  scope?: string;
  selectedServices?: Array<{
    id: string;
    name: string;
    detailUrl?: string;
  }>;
  citations?: AiCitation[];
}

export interface AiAvailability {
  available: boolean;
  reason?: string;
  model?: string;
}

export interface AskStatusStreamParams {
  message: string;
  history: AiChatHistoryEntry[];
  language: "en" | "de";
  serviceId?: string | null;
  pagePath?: string;
  signal?: AbortSignal;
}

function sanitizeCitation(value: unknown): AiCitation | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const title = String((value as { title?: unknown }).title || "").trim();
  const url = safeExternalHref((value as { url?: unknown }).url);

  if (!title || !url) {
    return null;
  }

  return {
    title,
    url,
  };
}

function sanitizeContextChunk(value: unknown): AiContextChunk {
  if (!value || typeof value !== "object") {
    return {};
  }

  const context = value as AiContextChunk;
  const selectedServices = Array.isArray(context.selectedServices)
    ? context.selectedServices
        .map((service) => {
          if (!service || typeof service !== "object") {
            return null;
          }

          const id = String(service.id || "").trim();
          const name = String(service.name || "").trim();
          const detailUrl = safeExternalHref(service.detailUrl);

          if (!id || !name) {
            return null;
          }

          return {
            id,
            name,
            detailUrl: detailUrl || undefined,
          };
        })
        .filter((service): service is NonNullable<typeof service> => Boolean(service))
    : undefined;

  return {
    scope: typeof context.scope === "string" ? context.scope : undefined,
    selectedServices,
    citations: Array.isArray(context.citations)
      ? context.citations.map((citation) => sanitizeCitation(citation)).filter((citation): citation is AiCitation => Boolean(citation))
      : undefined,
  };
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function shouldRequestLocalNetworkAccess(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    const hostname = url.hostname.toLowerCase();

    if (hostname.endsWith(".ts.net")) {
      return true;
    }

    if (/^10\./.test(hostname) || /^192\.168\./.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function withLocalNetworkAccess(init: RequestInit, baseUrl: string) {
  if (!shouldRequestLocalNetworkAccess(baseUrl)) {
    return init;
  }

  return {
    ...init,
    targetAddressSpace: "local",
  } as RequestInit & { targetAddressSpace: "local" };
}

export function getAiApiBaseUrl() {
  const configured = String(import.meta.env.VITE_AI_API_BASE_URL || "").trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }
  if (import.meta.env.DEV) {
    return "http://127.0.0.1:3000";
  }
  return "";
}

export function isAiConfigured() {
  return Boolean(getAiApiBaseUrl());
}

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(
      url,
      withLocalNetworkAccess(
        {
      ...init,
      signal: init?.signal || controller.signal,
        },
        url,
      ),
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function checkAiAvailability(): Promise<AiAvailability> {
  const baseUrl = getAiApiBaseUrl();
  if (!baseUrl) {
    return {
      available: false,
      reason: "not-configured",
    };
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/health`, 5000, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return {
        available: false,
        reason: `health-${response.status}`,
      };
    }

    const data = await response.json();
    return {
      available: data?.status === "ok",
      reason: data?.status === "ok" ? undefined : "backend-degraded",
      model: typeof data?.defaultModel === "string" ? data.defaultModel : undefined,
    };
  } catch {
    return {
      available: false,
      reason: "network",
    };
  }
}

async function readNdjsonStream(
  response: Response,
  onChunk: (chunk: Record<string, unknown>) => void,
) {
  if (!response.body) {
    throw new Error("Streaming response body is missing");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n")) {
      const newlineIndex = buffer.indexOf("\n");
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (!line) {
        continue;
      }

      onChunk(JSON.parse(line) as Record<string, unknown>);
    }
  }

  const finalLine = buffer.trim();
  if (finalLine) {
    onChunk(JSON.parse(finalLine) as Record<string, unknown>);
  }
}

export async function askStatusStream(
  params: AskStatusStreamParams,
  handlers: {
    onContext?: (context: AiContextChunk) => void;
    onDelta?: (contentDelta: string) => void;
    onDone?: () => void;
  },
) {
  const baseUrl = getAiApiBaseUrl();
  if (!baseUrl) {
    throw new Error("AI API base URL is not configured");
  }

  const response = await fetch(
    `${baseUrl}/api/ask-status/stream`,
    withLocalNetworkAccess(
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: params.message,
          history: params.history,
          language: params.language,
          serviceId: params.serviceId || undefined,
          pagePath: params.pagePath || undefined,
          maxTokens: 640,
        }),
        signal: params.signal,
      },
      baseUrl,
    ),
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(String(errorData?.error || `AI request failed with ${response.status}`));
  }

  await readNdjsonStream(response, (chunk) => {
    if (chunk.type === "error") {
      throw new Error(String(chunk.error || "AI request failed"));
    }

    if (chunk.type === "context") {
      handlers.onContext?.(sanitizeContextChunk(chunk.context));
      return;
    }

    if (chunk.type === "delta") {
      handlers.onDelta?.(String(chunk.content || ""));
      return;
    }

    if (chunk.type === "done") {
      handlers.onDone?.();
    }
  });
}
