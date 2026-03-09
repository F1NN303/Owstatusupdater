import { useMemo, useRef, useState, type TouchEventHandler } from "react";

interface UsePullToRefreshOptions {
  disabled?: boolean;
  isRefreshing?: boolean;
  maxPullPx?: number;
  onRefresh: () => Promise<void> | void;
  triggerPx?: number;
}

interface PullToRefreshBind {
  onTouchStart: TouchEventHandler<HTMLElement>;
  onTouchMove: TouchEventHandler<HTMLElement>;
  onTouchEnd: TouchEventHandler<HTMLElement>;
  onTouchCancel: TouchEventHandler<HTMLElement>;
}

interface UsePullToRefreshResult {
  bind: PullToRefreshBind;
  distance: number;
  isPullReady: boolean;
  isPullRefreshing: boolean;
  isPulling: boolean;
}

function isScrolledToTop() {
  if (typeof window === "undefined") {
    return false;
  }
  const scrollTop = Math.max(
    window.scrollY || 0,
    window.pageYOffset || 0,
    document.documentElement?.scrollTop || 0,
    document.body?.scrollTop || 0
  );
  return scrollTop <= 0;
}

export function usePullToRefresh({
  disabled = false,
  isRefreshing = false,
  maxPullPx = 96,
  onRefresh,
  triggerPx = 72,
}: UsePullToRefreshOptions): UsePullToRefreshResult {
  const [distance, setDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const trackingRef = useRef(false);
  const verticalPullRef = useRef(false);
  const refreshLockRef = useRef(false);

  const reset = () => {
    trackingRef.current = false;
    verticalPullRef.current = false;
    setDistance(0);
  };

  const bind = useMemo<PullToRefreshBind>(
    () => ({
      onTouchStart: (event) => {
        if (disabled || isRefreshing || event.touches.length !== 1 || !isScrolledToTop()) {
          reset();
          return;
        }
        const touch = event.touches[0];
        startXRef.current = touch.clientX;
        startYRef.current = touch.clientY;
        trackingRef.current = true;
        verticalPullRef.current = false;
        setDistance(0);
      },
      onTouchMove: (event) => {
        if (!trackingRef.current || disabled || isRefreshing || event.touches.length !== 1) {
          return;
        }

        const touch = event.touches[0];
        const deltaX = touch.clientX - startXRef.current;
        const deltaY = touch.clientY - startYRef.current;

        if (!verticalPullRef.current) {
          if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
            return;
          }
          if (Math.abs(deltaX) > Math.abs(deltaY) || deltaY <= 0) {
            reset();
            return;
          }
          if (!isScrolledToTop()) {
            reset();
            return;
          }
          verticalPullRef.current = true;
        }

        if (deltaY <= 0) {
          setDistance(0);
          return;
        }

        const nextDistance = Math.min(maxPullPx, deltaY * 0.45);
        setDistance(nextDistance);

        if (event.cancelable) {
          event.preventDefault();
        }
      },
      onTouchEnd: () => {
        const shouldRefresh =
          trackingRef.current &&
          verticalPullRef.current &&
          distance >= triggerPx &&
          !refreshLockRef.current &&
          !disabled &&
          !isRefreshing &&
          !isPullRefreshing;

        reset();

        if (!shouldRefresh) {
          return;
        }

        refreshLockRef.current = true;
        setIsPullRefreshing(true);
        void Promise.resolve(onRefresh()).finally(() => {
          refreshLockRef.current = false;
          setIsPullRefreshing(false);
        });
      },
      onTouchCancel: () => {
        reset();
      },
    }),
    [disabled, distance, isPullRefreshing, isRefreshing, maxPullPx, onRefresh, triggerPx]
  );

  return {
    bind,
    distance,
    isPullReady: distance >= triggerPx,
    isPullRefreshing,
    isPulling: trackingRef.current && distance > 0,
  };
}
