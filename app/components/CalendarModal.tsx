"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import type { CalendarData, Appointment } from "@/lib/types";
import { useModalFocusTrap } from "@/app/components/Modal";
import WaveIndicator from "@/app/components/WaveIndicator";
import { formatPhoneDisplay } from "@/lib/format-phone";
import { SLOT_STEP_MINUTES } from "@/lib/constants";

/**
 * Calcul du décalage horaire UTC pour Europe/Paris
 */
function parisOffset(localDate: string, localTime: string): string {
  const approx = new Date(`${localDate}T${localTime}:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "longOffset",
  });
  const parts = formatter.formatToParts(approx);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  const match = tzPart?.value.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : "+01:00";
}

function parisToISO(localDate: string, localTime: string): string {
  const offset = parisOffset(localDate, localTime);
  return new Date(`${localDate}T${localTime}:00${offset}`).toISOString();
}

function displayDate(date: string) {
  if (!date) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatTime(value: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function toMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function timeOptionsFor(opening: CalendarData["opening"]) {
  if (!opening) return [];
  const start = toMinutes(opening.open_time);
  const end = toMinutes(opening.close_time);
  return Array.from(
    { length: Math.max(0, Math.floor((end - start) / SLOT_STEP_MINUTES)) + 1 },
    (_, index) => {
      const minutes = start + index * SLOT_STEP_MINUTES;
      return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    },
  );
}

function TimePicker({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const fullOptions = useMemo(() => {
    if (value && !options.includes(value)) {
      return [...options, value].sort();
    }
    return options;
  }, [value, options]);

  return (
    <div className="time-picker">
      <button
        type="button"
        className="select time-picker-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {value || "Sélectionner une heure"}
      </button>
      {open && (
        <div
          className="time-picker-menu"
          role="listbox"
          aria-label="Choisir une heure"
        >
          {fullOptions.map((option) => (
            <button
              type="button"
              className={`time-picker-option ${option === value ? "selected" : ""}`}
              role="option"
              aria-selected={option === value}
              key={option}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export type CalendarModalMode =
  | { type: "create"; initialResourceId?: string; initialTime?: string }
  | { type: "view"; appointmentId: string };

interface CalendarModalProps {
  mode: CalendarModalMode;
  businessId?: string;
  currentDate: string;
  opening: CalendarData["opening"];
  resources: CalendarData["resources"];
  services: CalendarData["services"];
  appointments: CalendarData["appointments"];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onSuccessNotice: (message: string) => void;
}

export default function CalendarModal({
  mode,
  businessId,
  currentDate,
  opening,
  resources,
  services,
  appointments,
  onClose,
  onRefresh,
  onSuccessNotice,
}: CalendarModalProps) {
  const modalRef = useRef<HTMLElement>(null);
  useModalFocusTrap(modalRef, onClose);

  // Pour le mode vue / édition : récupérer le rendez-vous actuel
  const appointment: Appointment | undefined =
    mode.type === "view"
      ? appointments.find((a) => a.id === mode.appointmentId)
      : undefined;

  const isBlock = appointment ? appointment.booked_by === "block" : false;

  // Sous-mode pour un rendez-vous existant : 'details' (lecture) ou 'edit' (modification)
  const [viewSubMode, setViewSubMode] = useState<"details" | "edit">("details");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Onglet pour le mode création : 'appointment' ou 'block' (rendez-vous actif par défaut)
  const [createTab, setCreateTab] = useState<"appointment" | "block">("appointment");

  // Options d'horaires selon les heures d'ouverture
  const timeOptions = useMemo(() => timeOptionsFor(opening), [opening]);
  const defaultInitialTime =
    mode.type === "create" && mode.initialTime
      ? mode.initialTime
      : timeOptions[0] || "09:00";

  // ===================== ÉTATS DU FORMULAIRE RDV =====================
  const apptDateDefault = appointment
    ? appointment.start_time.slice(0, 10)
    : currentDate;
  const [apptDate, setApptDate] = useState(apptDateDefault);
  const [apptTime, setApptTime] = useState(
    appointment ? formatTime(appointment.start_time) : defaultInitialTime,
  );
  const [apptResourceId, setApptResourceId] = useState(
    appointment?.resource_id ||
      (mode.type === "create" ? mode.initialResourceId : "") ||
      resources[0]?.id ||
      "",
  );
  const [apptServiceId, setApptServiceId] = useState(
    appointment?.service_id || services[0]?.id || "",
  );
  const [customerName, setCustomerName] = useState(
    appointment?.customer?.name || "",
  );
  const [customerPhone, setCustomerPhone] = useState(
    appointment?.customer?.phone_number || "",
  );

  // ===================== ÉTATS DU FORMULAIRE BLOCAGE =====================
  const blockDateDefault = appointment
    ? appointment.start_time.slice(0, 10)
    : currentDate;
  const [blockDate, setBlockDate] = useState(blockDateDefault);
  const [blockTime, setBlockTime] = useState(
    appointment ? formatTime(appointment.start_time) : defaultInitialTime,
  );
  const [blockResourceId, setBlockResourceId] = useState(
    appointment?.resource_id ||
      (mode.type === "create" ? mode.initialResourceId : "") ||
      resources[0]?.id ||
      "",
  );

  // Calcul de la durée existante du blocage en minutes
  const existingBlockDuration = useMemo(() => {
    if (!appointment) return "30";
    const start = new Date(appointment.start_time).getTime();
    const end = new Date(appointment.end_time).getTime();
    const diffMin = Math.round((end - start) / 60000);
    return diffMin > 0 ? String(diffMin) : "30";
  }, [appointment]);

  const [blockDuration, setBlockDuration] = useState(existingBlockDuration);
  const [blockLabel, setBlockLabel] = useState(
    appointment?.block_label || "",
  );

  // États de feedback & chargement
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Trouver les informations de la ressource et du service actuels pour affichage
  const currentResource = resources.find(
    (r) =>
      r.id ===
      (mode.type === "view"
        ? appointment?.resource_id
        : createTab === "appointment"
          ? apptResourceId
          : blockResourceId),
  );

  const initialResourceName =
    mode.type === "create" && mode.initialResourceId
      ? resources.find((r) => r.id === mode.initialResourceId)?.name || "Coiffeur"
      : currentResource?.name || "Coiffeur";

  // ===================== ACTIONS =====================

  // 1. Créer un RDV
  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMessage("Le nom du client est obligatoire.");
      return;
    }
    if (!apptResourceId || !apptServiceId || !apptTime) {
      setErrorMessage("Veuillez renseigner tous les champs obligatoires.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const startTime = parisToISO(apptDate, apptTime);
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          resourceId: apptResourceId,
          serviceId: apptServiceId,
          startTime,
          ...(businessId ? { businessId } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Impossible de créer le rendez-vous.");
        setSubmitting(false);
        return;
      }

      onClose();
      await onRefresh();
      onSuccessNotice("Rendez-vous créé avec succès.");
    } catch {
      setErrorMessage("Erreur de connexion. Veuillez réessayer.");
      setSubmitting(false);
    }
  }

  // 2. Créer un blocage
  async function handleCreateBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!blockResourceId || !blockTime) {
      setErrorMessage("Veuillez renseigner l'horaire et le coiffeur.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const startTime = parisToISO(blockDate, blockTime);
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "block",
          resourceId: blockResourceId,
          startTime,
          durationMinutes: blockDuration,
          label: blockLabel.trim() || undefined,
          ...(businessId ? { businessId } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Impossible de bloquer ce créneau.");
        setSubmitting(false);
        return;
      }

      onClose();
      await onRefresh();
      onSuccessNotice("Créneau bloqué avec succès.");
    } catch {
      setErrorMessage("Erreur de connexion. Veuillez réessayer.");
      setSubmitting(false);
    }
  }

  // 3. Modifier un rendez-vous client
  async function handleUpdateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment) return;
    if (!customerName.trim()) {
      setErrorMessage("Le nom du client est obligatoire.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const startTime = parisToISO(apptDate, apptTime);
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime,
          serviceId: apptServiceId,
          resourceId: apptResourceId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          ...(businessId ? { businessId } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Impossible de modifier le rendez-vous.");
        setSubmitting(false);
        return;
      }

      onClose();
      await onRefresh();
      onSuccessNotice("Rendez-vous modifié avec succès.");
    } catch {
      setErrorMessage("Erreur de connexion. Veuillez réessayer.");
      setSubmitting(false);
    }
  }

  // 4. Modifier un blocage manuel
  async function handleUpdateBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!appointment) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const startTime = parisToISO(blockDate, blockTime);
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime,
          resourceId: blockResourceId,
          durationMinutes: Number(blockDuration),
          label: blockLabel.trim() || "",
          ...(businessId ? { businessId } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Impossible de modifier le blocage.");
        setSubmitting(false);
        return;
      }

      onClose();
      await onRefresh();
      onSuccessNotice("Blocage modifié avec succès.");
    } catch {
      setErrorMessage("Erreur de connexion. Veuillez réessayer.");
      setSubmitting(false);
    }
  }

  // 5. Supprimer (annuler) un rendez-vous ou blocage
  async function handleDelete() {
    if (!appointment) return;
    setSubmitting(true);
    setErrorMessage("");

    try {
      const qs = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
      const res = await fetch(`/api/appointments/${appointment.id}${qs}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Impossible de supprimer ce créneau.");
        setSubmitting(false);
        return;
      }

      onClose();
      await onRefresh();
      onSuccessNotice(
        isBlock
          ? "Blocage supprimé avec succès."
          : "Rendez-vous annulé avec succès.",
      );
    } catch {
      setErrorMessage("Erreur de connexion. Veuillez réessayer.");
      setSubmitting(false);
    }
  }

  // ===================== TITRES DE MODALE =====================
  const modalTitle = useMemo(() => {
    if (mode.type === "create") {
      if (mode.initialResourceId && mode.initialTime) {
        return `Créneau de ${initialResourceName} · ${mode.initialTime}`;
      }
      return "Nouveau créneau";
    }

    // mode view
    if (viewSubMode === "edit") {
      return isBlock
        ? "Modifier le blocage"
        : `Modifier le rendez-vous`;
    }

    return isBlock
      ? appointment?.block_label || "Créneau indisponible"
      : appointment?.customer?.name || "Client";
  }, [
    mode,
    viewSubMode,
    isBlock,
    initialResourceName,
    appointment,
  ]);

  const modalKicker = useMemo(() => {
    if (mode.type === "create") return "Planning du salon";
    if (viewSubMode === "edit") {
      return isBlock ? "Blocage manuel" : "Rendez-vous";
    }
    return isBlock ? "Blocage manuel" : "Détail du rendez-vous";
  }, [mode, viewSubMode, isBlock]);

  // Durée calculée pour affichage détails
  const displayDurationMin = useMemo(() => {
    if (!appointment) return 30;
    const start = new Date(appointment.start_time).getTime();
    const end = new Date(appointment.end_time).getTime();
    return Math.round((end - start) / 60000) || 30;
  }, [appointment]);

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-modal-title"
      >
        {/* En-tête partagé */}
        <div className="modal-header">
          <div>
            <p className="kicker">{modalKicker}</p>
            <h3
              id="calendar-modal-title"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              {mode.type === "view" &&
                !isBlock &&
                appointment?.booked_by === "phone" && (
                  <WaveIndicator state="success" />
                )}
              <span>{modalTitle}</span>
            </h3>
            {mode.type === "create" && mode.initialResourceId && (
              <p className="modal-note" style={{ margin: "0.25rem 0 0" }}>
                {displayDate(currentDate)}
              </p>
            )}
          </div>
          <button
            type="button"
            className="button ghost"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        {/* Message d'erreur éventuel sans fermeture du panneau */}
        {errorMessage && (
          <div className="error" role="alert" style={{ margin: "0.85rem 0 0.5rem" }}>
            {errorMessage}
          </div>
        )}

        {/* ============================================================
            CAS 1 : MODE CRÉATION (AVEC SEGMENTED CONTROL)
           ============================================================ */}
        {mode.type === "create" && (
          <>
            {/* Sélecteur à deux onglets (segmented control) */}
            <div className="segmented-control" role="tablist" aria-label="Type de créneau">
              <button
                type="button"
                role="tab"
                aria-selected={createTab === "appointment"}
                className={`segmented-control-btn ${createTab === "appointment" ? "active" : ""}`}
                onClick={() => {
                  setCreateTab("appointment");
                  setErrorMessage("");
                }}
              >
                Rendez-vous
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={createTab === "block"}
                className={`segmented-control-btn ${createTab === "block" ? "active" : ""}`}
                onClick={() => {
                  setCreateTab("block");
                  setErrorMessage("");
                }}
              >
                Bloquer
              </button>
            </div>

            {/* Onglet 1 : Créer un RDV */}
            {createTab === "appointment" && (
              <form onSubmit={handleCreateAppointment} className="modal-form" noValidate>
                <div className="field">
                  <label htmlFor="create-appt-date">Date</label>
                  <input
                    id="create-appt-date"
                    className="input"
                    type="date"
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <span className="field-label">Heure de début</span>
                  <TimePicker
                    value={apptTime}
                    options={timeOptions}
                    onChange={setApptTime}
                  />
                </div>

                <div className="field">
                  <label htmlFor="create-appt-resource">Coiffeur</label>
                  <select
                    id="create-appt-resource"
                    className="select"
                    value={apptResourceId}
                    onChange={(e) => setApptResourceId(e.target.value)}
                    required
                  >
                    {resources.map((res) => (
                      <option key={res.id} value={res.id}>
                        {res.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="create-appt-service">Prestation</label>
                  <select
                    id="create-appt-service"
                    className="select"
                    value={apptServiceId}
                    onChange={(e) => setApptServiceId(e.target.value)}
                    required
                  >
                    {services.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name} · {srv.duration_minutes} min
                        {srv.price != null ? ` · ${srv.price} €` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="create-customer-name">Nom du client</label>
                  <input
                    id="create-customer-name"
                    className="input"
                    placeholder="Ex. Marie Dupont"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="create-customer-phone">Téléphone (optionnel)</label>
                  <input
                    id="create-customer-phone"
                    className="input"
                    type="tel"
                    placeholder="06 12 34 56 78"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>

                <div className="modal-actions" style={{ width: "100%", marginTop: "1.2rem" }}>
                  <button type="button" className="button" onClick={onClose} disabled={submitting}>
                    Annuler
                  </button>
                  <span />
                  <button type="submit" className="button primary" disabled={submitting}>
                    {submitting ? "Création..." : "Créer le rendez-vous"}
                  </button>
                </div>
              </form>
            )}

            {/* Onglet 2 : Bloquer le créneau */}
            {createTab === "block" && (
              <form onSubmit={handleCreateBlock} className="modal-form" noValidate>
                <div className="field">
                  <label htmlFor="create-block-resource">Coiffeur</label>
                  <select
                    id="create-block-resource"
                    className="select"
                    value={blockResourceId}
                    onChange={(e) => setBlockResourceId(e.target.value)}
                    required
                  >
                    {resources.map((res) => (
                      <option key={res.id} value={res.id}>
                        {res.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <span className="field-label">Heure de début</span>
                  <TimePicker
                    value={blockTime}
                    options={timeOptions}
                    onChange={setBlockTime}
                  />
                </div>

                <div className="field">
                  <label htmlFor="create-block-duration">Durée</label>
                  <select
                    id="create-block-duration"
                    className="select"
                    value={blockDuration}
                    onChange={(e) => setBlockDuration(e.target.value)}
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 heure</option>
                    <option value="90">1 h 30</option>
                    <option value="120">2 heures</option>
                    <option value="180">3 heures</option>
                    <option value="240">Demi-journée (4h)</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="create-block-label">Libellé (optionnel)</label>
                  <input
                    id="create-block-label"
                    className="input"
                    placeholder="Ex. Pause déjeuner, réunion, formation..."
                    value={blockLabel}
                    onChange={(e) => setBlockLabel(e.target.value)}
                  />
                </div>

                <div className="modal-actions" style={{ width: "100%", marginTop: "1.2rem" }}>
                  <button type="button" className="button" onClick={onClose} disabled={submitting}>
                    Annuler
                  </button>
                  <span />
                  <button type="submit" className="button primary" disabled={submitting}>
                    {submitting ? "Enregistrement..." : "Bloquer le créneau"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* ============================================================
            CAS 2 : MODE VUE DÉTAILS D'UN ÉVÉNEMENT EXISTANT
           ============================================================ */}
        {mode.type === "view" && appointment && viewSubMode === "details" && (
          <>
            <div className="appointment-detail-card">
              {/* Informations Client (uniquement si RDV) */}
              {!isBlock && (
                <>
                  <div className="appointment-detail-item">
                    <b>Client</b>
                    <span>{appointment.customer?.name || "Client non renseigné"}</span>
                  </div>

                  <div className="appointment-detail-item">
                    <b>Téléphone</b>
                    {appointment.customer?.phone_number ? (
                      <a
                        href={`tel:${appointment.customer.phone_number.replace(/\s/g, "")}`}
                        title="Appeler ce numéro"
                      >
                        <span aria-hidden="true">📞</span>
                        <span>{formatPhoneDisplay(appointment.customer.phone_number)}</span>
                      </a>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>Non renseigné</span>
                    )}
                  </div>
                </>
              )}

              {/* Libellé (si Blocage) */}
              {isBlock && (
                <div className="appointment-detail-item">
                  <b>Motif du blocage</b>
                  <span>{appointment.block_label || "Indisponible"}</span>
                </div>
              )}

              {/* Prestation (si RDV) */}
              {!isBlock && (
                <div className="appointment-detail-item">
                  <b>Prestation & Tarif</b>
                  <span>
                    {appointment.service?.name || "Prestation"}
                    {" · "}
                    {appointment.service?.duration_minutes || displayDurationMin} min
                    {appointment.service?.price != null && (
                      <strong style={{ marginLeft: "0.25rem", color: "var(--color-accent-soft)" }}>
                        · {appointment.service.price} €
                      </strong>
                    )}
                  </span>
                </div>
              )}

              {/* Coiffeur */}
              <div className="appointment-detail-item">
                <b>Coiffeur</b>
                <span>
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: currentResource?.color || "var(--color-accent)",
                      display: "inline-block",
                    }}
                  />
                  <span>{currentResource?.name || "Coiffeur"}</span>
                </span>
              </div>

              {/* Date & Horaires */}
              <div className="appointment-detail-item">
                <b>Date & Horaire</b>
                <span>
                  {formatTime(appointment.start_time)} – {formatTime(appointment.end_time)}
                  {" "}
                  <small style={{ color: "var(--color-text-muted)" }}>
                    ({displayDurationMin} min)
                  </small>
                </span>
                <small style={{ color: "var(--color-text-muted)", marginTop: "2px" }}>
                  {displayDate(appointment.start_time.slice(0, 10))}
                </small>
              </div>

              {/* Source / Origine du RDV */}
              {!isBlock && (
                <div className="appointment-detail-item">
                  <b>Source</b>
                  <div>
                    {appointment.booked_by === "phone" ? (
                      <span className="source-badge phone">
                        <WaveIndicator state="success" />
                        <span>Agent vocal IA</span>
                      </span>
                    ) : appointment.booked_by === "client" || appointment.booked_by === "web" ? (
                      <span className="source-badge">
                        <span>Réservation en ligne</span>
                      </span>
                    ) : (
                      <span className="source-badge" style={{ background: "var(--color-bg-panel)", color: "var(--color-text-muted)" }}>
                        <span>Saisie manuelle</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Boîte de confirmation de suppression en deux temps */}
            {confirmDelete && (
              <div className="confirm-box" style={{ margin: "1rem 0" }}>
                <strong>
                  {isBlock
                    ? "Supprimer définitivement ce blocage ?"
                    : "Annuler définitivement ce rendez-vous ?"}
                </strong>
                <span>
                  {isBlock
                    ? "Le créneau redeviendra disponible pour les réservations."
                    : "Le client et le salon seront mis à jour et le créneau redeviendra libre."}
                </span>
                <div className="actions" style={{ marginTop: "0.6rem" }}>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={submitting}
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    className="button danger"
                    onClick={handleDelete}
                    disabled={submitting}
                  >
                    {submitting ? "Suppression..." : "Confirmer la suppression"}
                  </button>
                </div>
              </div>
            )}

            {/* Actions du mode détails */}
            <div className="modal-actions" style={{ marginTop: "1.25rem" }}>
              {!confirmDelete && (
                <button
                  type="button"
                  className="button danger"
                  onClick={() => setConfirmDelete(true)}
                  disabled={submitting}
                >
                  Supprimer
                </button>
              )}
              <span />
              <button
                type="button"
                className="button"
                onClick={onClose}
                disabled={submitting}
              >
                Fermer
              </button>
              {!confirmDelete && (
                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    setViewSubMode("edit");
                    setErrorMessage("");
                  }}
                  disabled={submitting}
                >
                  Modifier
                </button>
              )}
            </div>
          </>
        )}

        {/* ============================================================
            CAS 3 : MODE ÉDITION D'UN ÉVÉNEMENT EXISTANT
           ============================================================ */}
        {mode.type === "view" && appointment && viewSubMode === "edit" && (
          <>
            {/* Si c'est un rendez-vous client */}
            {!isBlock ? (
              <form onSubmit={handleUpdateAppointment} className="modal-form" noValidate>
                <div className="field">
                  <label htmlFor="edit-appt-date">Date</label>
                  <input
                    id="edit-appt-date"
                    className="input"
                    type="date"
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <span className="field-label">Heure</span>
                  <TimePicker
                    value={apptTime}
                    options={timeOptions}
                    onChange={setApptTime}
                  />
                </div>

                <div className="field">
                  <label htmlFor="edit-appt-resource">Coiffeur</label>
                  <select
                    id="edit-appt-resource"
                    className="select"
                    value={apptResourceId}
                    onChange={(e) => setApptResourceId(e.target.value)}
                    required
                  >
                    {resources.map((res) => (
                      <option key={res.id} value={res.id}>
                        {res.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="edit-appt-service">Prestation</label>
                  <select
                    id="edit-appt-service"
                    className="select"
                    value={apptServiceId}
                    onChange={(e) => setApptServiceId(e.target.value)}
                    required
                  >
                    {services.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name} · {srv.duration_minutes} min
                        {srv.price != null ? ` · ${srv.price} €` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="edit-customer-name">Nom du client</label>
                  <input
                    id="edit-customer-name"
                    className="input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="edit-customer-phone">Téléphone</label>
                  <input
                    id="edit-customer-phone"
                    className="input"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>

                <div className="modal-actions" style={{ width: "100%", marginTop: "1.25rem" }}>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setViewSubMode("details");
                      setErrorMessage("");
                    }}
                    disabled={submitting}
                  >
                    Retour aux détails
                  </button>
                  <span />
                  <button
                    type="submit"
                    className="button primary"
                    disabled={submitting}
                  >
                    {submitting ? "Enregistrement..." : "Enregistrer les modifications"}
                  </button>
                </div>
              </form>
            ) : (
              /* Si c'est un blocage manuel */
              <form onSubmit={handleUpdateBlock} className="modal-form" noValidate>
                <div className="field">
                  <label htmlFor="edit-block-date">Date</label>
                  <input
                    id="edit-block-date"
                    className="input"
                    type="date"
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <span className="field-label">Heure</span>
                  <TimePicker
                    value={blockTime}
                    options={timeOptions}
                    onChange={setBlockTime}
                  />
                </div>

                <div className="field">
                  <label htmlFor="edit-block-resource">Coiffeur</label>
                  <select
                    id="edit-block-resource"
                    className="select"
                    value={blockResourceId}
                    onChange={(e) => setBlockResourceId(e.target.value)}
                    required
                  >
                    {resources.map((res) => (
                      <option key={res.id} value={res.id}>
                        {res.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="edit-block-duration">Durée</label>
                  <select
                    id="edit-block-duration"
                    className="select"
                    value={blockDuration}
                    onChange={(e) => setBlockDuration(e.target.value)}
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="45">45 minutes</option>
                    <option value="60">1 heure</option>
                    <option value="90">1 h 30</option>
                    <option value="120">2 heures</option>
                    <option value="180">3 heures</option>
                    <option value="240">Demi-journée (4h)</option>
                  </select>
                </div>

                <div className="field" style={{ width: "100%" }}>
                  <label htmlFor="edit-block-label">Libellé</label>
                  <input
                    id="edit-block-label"
                    className="input"
                    placeholder="Ex. Pause déjeuner, réunion..."
                    value={blockLabel}
                    onChange={(e) => setBlockLabel(e.target.value)}
                  />
                </div>

                <div className="modal-actions" style={{ width: "100%", marginTop: "1.25rem" }}>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setViewSubMode("details");
                      setErrorMessage("");
                    }}
                    disabled={submitting}
                  >
                    Retour aux détails
                  </button>
                  <span />
                  <button
                    type="submit"
                    className="button primary"
                    disabled={submitting}
                  >
                    {submitting ? "Enregistrement..." : "Enregistrer les modifications"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
