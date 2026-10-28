"use client";

import React from "react";
import { usePageTransition } from "@/app/components/PageTransitionProvider";

export interface PageLoaderOverlayProps {
  isFading?: boolean;
  className?: string;
  isRootProvider?: boolean;
}

export default function PageLoaderOverlay({
  isFading = false,
  className = "",
  isRootProvider = false,
}: PageLoaderOverlayProps) {
  const { isTransitioning } = usePageTransition();

  // If this overlay is rendered inside a loading.tsx boundary during an active client transition,
  // suppress it so the root PageTransitionProvider handles the single, continuous overlay.
  if (!isRootProvider && isTransitioning) {
    return null;
  }

  return (
    <div
      role="status"
      aria-label="Chargement"
      aria-live="polite"
      className={`page-loader-overlay ${isFading ? "is-fading" : ""} ${className}`}
    >
      <svg
        className="page-loader-svg"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          className="page-loader-bubble"
          d="M14 24C14 17.373 19.373 12 26 12H38C46.837 12 54 19.163 54 28C54 36.837 46.837 44 38 44H24L15 52V38.5C14.36 36.1 14 33.5 14 30.8V24Z"
          fill="#BD5B39"
        />
        <rect className="page-loader-bar" x="24" y="17" width="4" height="26" rx="2" fill="#F2ECE1" />
        <rect className="page-loader-bar" x="32" y="17" width="4" height="26" rx="2" fill="#F2ECE1" />
        <rect className="page-loader-bar" x="40" y="17" width="4" height="26" rx="2" fill="#F2ECE1" />
      </svg>
      <div className="page-loader-word">
        vokalia
        <span>Chargement…</span>
      </div>
    </div>
  );
}
