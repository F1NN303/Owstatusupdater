import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

function PullToRefreshHarness({
  onRefresh,
  isRefreshing = false,
}: {
  onRefresh: () => Promise<void> | void;
  isRefreshing?: boolean;
}) {
  const pull = usePullToRefresh({
    isRefreshing,
    onRefresh,
  });

  return (
    <div>
      <div data-testid="distance">{String(pull.distance)}</div>
      <div data-testid="ready">{pull.isPullReady ? "ready" : "idle"}</div>
      <div data-testid="area" {...pull.bind}>
        touch
      </div>
    </div>
  );
}

describe("usePullToRefresh", () => {
  beforeEach(() => {
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 0,
    });
  });

  it("triggers refresh after a vertical pull from the top", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<PullToRefreshHarness onRefresh={onRefresh} />);

    const area = screen.getByTestId("area");

    fireEvent.touchStart(area, {
      touches: [{ clientX: 16, clientY: 8 }],
    });
    fireEvent.touchMove(area, {
      touches: [{ clientX: 18, clientY: 240 }],
      cancelable: true,
    });

    expect(screen.getByTestId("ready")).toHaveTextContent("ready");

    fireEvent.touchEnd(area);

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });

  it("does not trigger refresh for a horizontal swipe", async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<PullToRefreshHarness onRefresh={onRefresh} />);

    const area = screen.getByTestId("area");

    fireEvent.touchStart(area, {
      touches: [{ clientX: 12, clientY: 12 }],
    });
    fireEvent.touchMove(area, {
      touches: [{ clientX: 180, clientY: 18 }],
      cancelable: true,
    });
    fireEvent.touchEnd(area);

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(0));
  });

  it("does not trigger refresh when the page is already scrolled", async () => {
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: 32,
    });

    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<PullToRefreshHarness onRefresh={onRefresh} />);

    const area = screen.getByTestId("area");

    fireEvent.touchStart(area, {
      touches: [{ clientX: 16, clientY: 12 }],
    });
    fireEvent.touchMove(area, {
      touches: [{ clientX: 20, clientY: 220 }],
      cancelable: true,
    });
    fireEvent.touchEnd(area);

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(0));
  });
});
