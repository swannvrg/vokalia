"use client";

import { useCallback, useEffect, useState } from "react";

type CallbackRequest = {
  id: string;
  customer_name: string;
  callback_number: string;
  reason: string;
  status: "new" | "done";
  created_at: string;
  called_at: string | null;
};

const formatParisDateTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

/**
 * Format an E.164 phone number for display.
 * +33612345678 → 06 12 34 56 78
 * Falls back to the raw number if it doesn't match known patterns.
 */
export function formatPhoneDisplay(e164: string): string {
  const fr = e164.match(/^\+33(\d{9})$/);
  if (fr) {
    const digits = `0${fr[1]}`;
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ");
  }
  return e164;
}

export default function CallbackPanel({
  businessId,
  onError,
}: {
  businessId?: string;
  onError: (message: string) => void;
}) {
  const [callbacks, setCallbacks] = useState<CallbackRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"new" | "done">("new");
  const [expanded, setExpanded] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (businessId) query.set("businessId", businessId);
    try {
      const response = await fetch(`/api/callbacks?${query.toString()}`);
      if (!response.ok) return;
      const data = await response.json();
      setCallbacks(data);
      setLoaded(true);
    } catch {
      /* silently fail — non-critical panel */
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dir = sortOrder === "asc" ? 1 : -1;

  const newItems = callbacks
    .filter((c) => c.status === "new")
    .sort((a, b) => dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));

  const doneItems = callbacks
    .filter((c) => c.status === "done")
    .sort((a, b) => {
      const aTime = a.called_at ? new Date(a.called_at).getTime() : 0;
      const bTime = b.called_at ? new Date(b.called_at).getTime() : 0;
      return dir * (aTime - bTime);
    });

  const items = tab === "new" ? newItems : doneItems;

  async function toggleStatus(id: string, newStatus: "new" | "done") {
    setUpdating(id);
    try {
      const response = await fetch(`/api/callbacks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(businessId ? { businessId } : {}),
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        onError(result.error || "Erreur lors de la mise à jour.");
      } else {
        // Optimistic: update locally, then refetch to sync
        setCallbacks((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  status: newStatus,
                  called_at: newStatus === "done" ? new Date().toISOString() : null,
                }
              : c,
          ),
        );
        await load();
      }
    } catch {
      onError("Erreur réseau lors de la mise à jour.");
    }
    setUpdating(null);
  }

  if (!loaded) return null;

  return (
    <section className="callback-panel">
      <button
        className="callback-panel-header"
        onClick={() => setExpanded((v) => !v)}
        type="button"
        aria-expanded={expanded}
      >
        <div className="callback-panel-title">
          <span className="callback-panel-icon">📞</span>
          <span>Rappels</span>
          {newItems.length > 0 && (
            <span className="callback-badge">{newItems.length}</span>
          )}
        </div>
        <span className={`callback-chevron ${expanded ? "open" : ""}`}>▾</span>
      </button>

      {expanded && (
        <div className="callback-panel-body">
          <div className="callback-toolbar">
            <div className="callback-tabs">
              <button
                className={`callback-tab ${tab === "new" ? "active" : ""}`}
                onClick={() => setTab("new")}
                type="button"
              >
                À appeler{newItems.length > 0 ? ` (${newItems.length})` : ""}
              </button>
              <button
                className={`callback-tab ${tab === "done" ? "active" : ""}`}
                onClick={() => setTab("done")}
                type="button"
              >
                Déjà appelés{doneItems.length > 0 ? ` (${doneItems.length})` : ""}
              </button>
            </div>
            <button
              className="callback-sort"
              onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
              type="button"
              title={sortOrder === "asc" ? "Ancien → Récent" : "Récent → Ancien"}
            >
              {sortOrder === "asc" ? "↑ Ancien" : "↓ Récent"}
            </button>
          </div>

          {items.length === 0 ? (
            <div className="callback-empty">
              {tab === "new"
                ? "Aucune demande de rappel en attente."
                : "Aucun rappel traité pour le moment."}
            </div>
          ) : (
            <ul className="callback-list">
              {items.map((item) => (
                <li key={item.id} className="callback-item">
                  <div className="callback-item-info">
                    <strong>{item.customer_name || "Client inconnu"}</strong>
                    <a
                      href={`tel:${item.callback_number}`}
                      className="callback-phone"
                      title={`Appeler ${item.callback_number}`}
                    >
                      {formatPhoneDisplay(item.callback_number)}
                    </a>
                    {item.reason && (
                      <span className="callback-reason">{item.reason}</span>
                    )}
                    <span className="callback-date">
                      {tab === "done" && item.called_at
                        ? `Appelé le ${formatParisDateTime(item.called_at)}`
                        : `Demandé le ${formatParisDateTime(item.created_at)}`}
                    </span>
                  </div>
                  <button
                    className={`button ${tab === "new" ? "primary" : ""} callback-action`}
                    disabled={updating === item.id}
                    onClick={() =>
                      toggleStatus(item.id, tab === "new" ? "done" : "new")
                    }
                  >
                    {updating === item.id
                      ? "..."
                      : tab === "new"
                        ? "✓ Appelé"
                        : "↩ Remettre"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
