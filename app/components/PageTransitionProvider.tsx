"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PageLoaderOverlay from "@/app/components/PageLoaderOverlay";

interface PageTransitionContextValue {
  isTransitioning: boolean;
  startTransition: (targetUrl?: string) => void;
  endTransition: () => void;
  signalReady: () => void;
}

const PageTransitionContext = createContext<PageTransitionContextValue>({
  isTransitioning: false,
  startTransition: () => {},
  endTransition: () => {},
  signalReady: () => {},
});

export function usePageTransition() {
  return useContext(PageTransitionContext);
}

/**
 * usePageReady signals that the client component has finished loading its initial data.
 * Can be called with a boolean `usePageReady(isReady)` or invoked as a function `signalReady()`.
 */
export function usePageReady(ready?: boolean) {
  const { signalReady } = useContext(PageTransitionContext);
  useEffect(() => {
    if (ready === true) {
      signalReady();
    }
  }, [ready, signalReady]);
  return signalReady;
}

/**
 * PageReady component to declaratively signal page readiness upon mounting.
 */
export function PageReady() {
  const signalReady = usePageReady();
  useEffect(() => {
    signalReady();
  }, [signalReady]);
  return null;
}

const MIN_DISPLAY_MS = 600;
const DASHBOARD_DELAY_MS = 200;
const SAFETY_TIMEOUT_MS = 8000;
const FADE_DURATION_MS = 250;

/**
 * Checks if a path belongs to the dashboard (backoffice) area.
 */
export function isDashboardPath(path: string): boolean {
  const cleanPath = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (
    cleanPath === "/calendrier" ||
    cleanPath.startsWith("/calendrier/") ||
    cleanPath === "/profil" ||
    cleanPath.startsWith("/profil/") ||
    cleanPath === "/admin" ||
    cleanPath.startsWith("/admin/") ||
    cleanPath === "/qr-code" ||
    cleanPath.startsWith("/qr-code/")
  ) {
    return true;
  }
  const segments = cleanPath.split("/").filter(Boolean);
  if (
    segments.length >= 2 &&
    (segments[1] === "calendrier" ||
      segments[1] === "profil" ||
      segments[1] === "qr-code")
  ) {
    return true;
  }
  return false;
}

/**
 * Checks if a route relies on client-side data fetching and will call signalReady().
 */
export function routeRequiresSignalReady(path: string): boolean {
  const cleanPath = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (
    cleanPath === "/calendrier" ||
    cleanPath === "/profil" ||
    cleanPath === "/admin" ||
    cleanPath === "/prendre-rdv"
  ) {
    return true;
  }
  const segments = cleanPath.split("/").filter(Boolean);
  if (
    segments.length >= 2 &&
    (segments[1] === "calendrier" || segments[1] === "profil")
  ) {
    return true;
  }
  return false;
}

/**
 * RouteWatcher detects pathname and searchParams changes and informs PageTransitionProvider.
 * Wrapped in Suspense to avoid de-opting root layout SSR.
 */
function RouteWatcher({ onNavigate }: { onNavigate: (pathname: string) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchString = searchParams?.toString();
  const initialRef = useRef(true);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }
    onNavigate(pathname);
  }, [pathname, searchString, onNavigate]);

  return null;
}

export default function PageTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isFading, setIsFading] = useState(false);

  const isTransitioningRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const isReadyRef = useRef(false);
  const isDashboardNavRef = useRef(false);
  const showStartTimeRef = useRef<number>(0);
  const isOverlayVisibleRef = useRef(false);

  const showDelayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const minDisplayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep isOverlayVisibleRef in sync with isOpen state
  useEffect(() => {
    isOverlayVisibleRef.current = isOpen;
  }, [isOpen]);

  const clearAllTimers = useCallback(() => {
    if (showDelayTimerRef.current) {
      clearTimeout(showDelayTimerRef.current);
      showDelayTimerRef.current = null;
    }
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    if (minDisplayTimerRef.current) {
      clearTimeout(minDisplayTimerRef.current);
      minDisplayTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const completeEndTransition = useCallback(() => {
    if (showDelayTimerRef.current) {
      clearTimeout(showDelayTimerRef.current);
      showDelayTimerRef.current = null;
    }

    if (!isOverlayVisibleRef.current) {
      // Overlay never appeared (dashboard quick load < 200ms)
      isTransitioningRef.current = false;
      setIsTransitioning(false);
      clearAllTimers();
      return;
    }

    setIsFading(true);
    fadeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
      setIsFading(false);
      isTransitioningRef.current = false;
      setIsTransitioning(false);
      clearAllTimers();
    }, FADE_DURATION_MS);
  }, [clearAllTimers]);

  const checkAndCompleteTransition = useCallback(() => {
    if (!isTransitioningRef.current) return;
    if (!hasNavigatedRef.current || !isReadyRef.current) return;

    // If dashboard navigation and overlay was never shown (< 200ms elapsed)
    if (isDashboardNavRef.current && !isOverlayVisibleRef.current) {
      if (showDelayTimerRef.current) {
        clearTimeout(showDelayTimerRef.current);
        showDelayTimerRef.current = null;
      }
      isTransitioningRef.current = false;
      setIsTransitioning(false);
      clearAllTimers();
      return;
    }

    const minDuration = isDashboardNavRef.current ? 0 : MIN_DISPLAY_MS;
    const elapsed = Date.now() - showStartTimeRef.current;

    if (elapsed < minDuration) {
      const remaining = minDuration - elapsed;
      minDisplayTimerRef.current = setTimeout(() => {
        completeEndTransition();
      }, remaining);
    } else {
      completeEndTransition();
    }
  }, [clearAllTimers, completeEndTransition]);

  const endTransition = useCallback(() => {
    hasNavigatedRef.current = true;
    isReadyRef.current = true;
    checkAndCompleteTransition();
  }, [checkAndCompleteTransition]);

  const signalReady = useCallback(() => {
    if (!isTransitioningRef.current) return;
    isReadyRef.current = true;
    if (hasNavigatedRef.current) {
      checkAndCompleteTransition();
    }
  }, [checkAndCompleteTransition]);

  const handleRouteNavigated = useCallback(
    (newPathname: string) => {
      if (!isTransitioningRef.current) return;
      hasNavigatedRef.current = true;

      // If destination does not require signalReady (e.g. server component like profil-public)
      const needsReady = routeRequiresSignalReady(newPathname);
      if (!needsReady) {
        isReadyRef.current = true;
        checkAndCompleteTransition();
      } else if (isReadyRef.current) {
        checkAndCompleteTransition();
      }
    },
    [checkAndCompleteTransition]
  );

  const startTransition = useCallback(
    (targetUrl?: string) => {
      clearAllTimers();

      const currentPath = window.location.pathname;
      let targetPath = currentPath;
      if (targetUrl) {
        try {
          targetPath = new URL(targetUrl, window.location.origin).pathname;
        } catch {
          targetPath = targetUrl;
        }
      }

      const isDashboardNav =
        isDashboardPath(currentPath) && isDashboardPath(targetPath);

      isTransitioningRef.current = true;
      setIsTransitioning(true);
      hasNavigatedRef.current = false;
      isReadyRef.current = false;
      isDashboardNavRef.current = isDashboardNav;

      if (isDashboardNav) {
        // In dashboard: only show overlay if loading exceeds 200ms
        showDelayTimerRef.current = setTimeout(() => {
          showStartTimeRef.current = Date.now();
          setIsOpen(true);
          setIsFading(false);
        }, DASHBOARD_DELAY_MS);
      } else {
        // Landing / login / onboarding / public: show immediately with 600ms minimum
        showStartTimeRef.current = Date.now();
        setIsOpen(true);
        setIsFading(false);
      }

      // Safety timeout to dismiss overlay if navigation is aborted or fails
      safetyTimerRef.current = setTimeout(() => {
        completeEndTransition();
      }, SAFETY_TIMEOUT_MS);
    },
    [clearAllTimers, completeEndTransition]
  );

  // Global click interception for internal links and popstate listener
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest<HTMLAnchorElement>("a[href]");
      if (!anchor) return;

      if (anchor.hasAttribute("download")) return;
      if (
        anchor.hasAttribute("data-no-transition") ||
        anchor.closest("[data-no-transition]")
      ) {
        return;
      }

      const targetAttr = anchor.getAttribute("target");
      if (targetAttr && targetAttr !== "_self") return;

      const rel = anchor.getAttribute("rel");
      if (rel && rel.includes("external")) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      if (
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith("/api/")) return;

      // Ignore in-page hash anchors on current page
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        if (url.hash || href.startsWith("#")) return;
        return;
      }

      startTransition(url.href);
    };

    const handlePopState = () => {
      startTransition(window.location.href);
    };

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      clearAllTimers();
    };
  }, [startTransition, clearAllTimers]);

  const contextValue = useMemo<PageTransitionContextValue>(
    () => ({
      isTransitioning,
      startTransition,
      endTransition,
      signalReady,
    }),
    [isTransitioning, startTransition, endTransition, signalReady]
  );

  return (
    <PageTransitionContext.Provider value={contextValue}>
      <Suspense fallback={null}>
        <RouteWatcher onNavigate={handleRouteNavigated} />
      </Suspense>

      {children}

      {isOpen && <PageLoaderOverlay isFading={isFading} isRootProvider={true} />}
    </PageTransitionContext.Provider>
  );
}

/**
 * useTransitionRouter wraps Next.js useRouter to trigger the transition overlay
 * on router.push, router.replace, router.back, and router.forward.
 */
export function useTransitionRouter() {
  const router = useRouter();
  const { startTransition } = usePageTransition();

  const push = useCallback(
    (href: string, options?: Parameters<typeof router.push>[1]) => {
      try {
        const target = new URL(href, window.location.href);
        if (
          target.origin === window.location.origin &&
          target.href !== window.location.href
        ) {
          startTransition(target.href);
        }
      } catch {
        startTransition(href);
      }
      router.push(href, options);
    },
    [router, startTransition]
  );

  const replace = useCallback(
    (href: string, options?: Parameters<typeof router.replace>[1]) => {
      try {
        const target = new URL(href, window.location.href);
        if (
          target.origin === window.location.origin &&
          target.href !== window.location.href
        ) {
          startTransition(target.href);
        }
      } catch {
        startTransition(href);
      }
      router.replace(href, options);
    },
    [router, startTransition]
  );

  const back = useCallback(() => {
    startTransition();
    router.back();
  }, [router, startTransition]);

  const forward = useCallback(() => {
    startTransition();
    router.forward();
  }, [router, startTransition]);

  return useMemo(
    () => ({
      ...router,
      push,
      replace,
      back,
      forward,
    }),
    [router, push, replace, back, forward]
  );
}
