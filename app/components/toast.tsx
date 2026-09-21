"use client";

import { useEffect } from "react";

type ToastProps = {
  message: string;
  type: "error" | "success";
  onClose: () => void;
  duration?: number;
};

export default function Toast({ message, type, onClose, duration = 3500 }: ToastProps) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timeout);
  }, [duration, message, onClose]);

  return <div className={`toast toast-${type}`} role="status" aria-live="polite"><span>{message}</span><button type="button" onClick={onClose} aria-label="Fermer le message">×</button></div>;
}
