import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppShellProvider } from "@/lib/appShell";

const askStatusStream = vi.fn();
const checkAiAvailability = vi.fn();
const isAiConfigured = vi.fn();

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/aiStatusChat", () => ({
  askStatusStream: (...args: unknown[]) => askStatusStream(...args),
  checkAiAvailability: (...args: unknown[]) => checkAiAvailability(...args),
  isAiConfigured: (...args: unknown[]) => isAiConfigured(...args),
}));

import AiStatusAssistant from "./AiStatusAssistant";

function renderAssistant(initialEntry = "/status/github") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppShellProvider>
        <AiStatusAssistant />
      </AppShellProvider>
    </MemoryRouter>
  );
}

describe("AiStatusAssistant", () => {
  beforeEach(() => {
    window.localStorage.clear();
    isAiConfigured.mockReturnValue(true);
    checkAiAvailability.mockResolvedValue({ available: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("shows a clear unavailable state when the backend cannot be reached", async () => {
    checkAiAvailability.mockResolvedValueOnce({
      available: false,
      reason: "network",
    });

    renderAssistant("/");

    expect(await screen.findByText("AI unavailable")).toBeInTheDocument();
    expect(screen.getByText("The AI backend could not be reached from your browser.")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("can recover from an unavailable backend after a retry", async () => {
    checkAiAvailability
      .mockResolvedValueOnce({
        available: false,
        reason: "network",
      })
      .mockResolvedValueOnce({
        available: true,
      });

    renderAssistant("/");

    fireEvent.click(await screen.findByRole("button", { name: /^retry$/i }));

    await screen.findByText("AI online");
    expect(screen.getByRole("textbox")).not.toBeDisabled();
  });

  it("streams a grounded reply with the current service context", async () => {
    askStatusStream.mockImplementation(async (params, handlers) => {
      expect(params).toMatchObject({
        message: "Is GitHub currently having problems?",
        language: "en",
        serviceId: "github",
        pagePath: "/status/github",
      });

      handlers.onContext?.({
        citations: [
          {
            title: "GitHub summary",
            url: "https://example.com/github/summary.json",
          },
        ],
      });
      handlers.onDelta?.("GitHub currently shows stable operations.");
      handlers.onDelta?.("\n\n**Current status:**");
      handlers.onDelta?.("\n- All systems operational");
      handlers.onDone?.();
    });

    renderAssistant("/status/github");

    const input = await screen.findByRole("textbox");
    fireEvent.change(input, {
      target: {
        value: "Is GitHub currently having problems?",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => {
      expect(askStatusStream).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText("GitHub currently shows stable operations.")).toBeInTheDocument();
    expect(screen.getByText("Current status:")).toBeInTheDocument();
    expect(screen.getByText("All systems operational")).toBeInTheDocument();
    expect(screen.queryByText(/\*\*Current status:\*\*/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub summary" })).toHaveAttribute(
      "href",
      "https://example.com/github/summary.json"
    );
  });
});
