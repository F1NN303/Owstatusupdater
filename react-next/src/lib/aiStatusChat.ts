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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
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
    return await fetch(url, {
      ...init,
      signal: init?.signal || controller.signal,
    });
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

  const response = await fetch(`${baseUrl}/api/ask-status/stream`, {
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
      maxTokens: 512,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(String(errorData?.error || `AI request failed with ${response.status}`));
  }

  await readNdjsonStream(response, (chunk) => {
    if (chunk.type === "error") {
      throw new Error(String(chunk.error || "AI request failed"));
    }

    if (chunk.type === "context") {
      handlers.onContext?.(chunk.context as AiContextChunk);
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
