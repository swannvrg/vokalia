"use client";

import { useEffect, useState } from "react";

type ToastProps = {
  message: string;
  type: "error" | "success";
  onClose: () => void;
  duration?: number;
};

export default function Toast({ message, type, onClose, duration = 3500 }: ToastProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
    const hideTimeout = window.setTimeout(() => setVisible(false), duration - 300);
    const closeTimeout = window.setTimeout(onClose, duration);
    return () => { window.clearTimeout(hideTimeout); window.clearTimeout(closeTimeout); };
  }, [duration, message, onClose]);

  return <div className={`toast toast-${type}`} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(-1rem)", transition: "all 0.3s ease" }} role="status" aria-live="polite"><span>{message}</span><button type="button" onClick={() => { setVisible(false); setTimeout(onClose, 300); }} aria-label="Fermer le message">×</button></div>;
}
