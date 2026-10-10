"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CalendarData } from "@/lib/types";
import Toast from "@/app/components/toast";
import Logo from "@/app/components/Logo";
import WaveIndicator from "@/app/components/WaveIndicator";
import { useRouter } from "next/navigation";
import CallbackPanel from "@/app/components/CallbackPanel";

const parisDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(),
  );

/**
 * Compute the UTC offset string (e.g. "+02:00" or "+01:00") for Europe/Paris
 * at a given local date and time. Handles CET/CEST transitions automatically.
 */
function parisOffset(localDate: string, localTime: string): string {
  // Build an approximate UTC date to seed the formatter
  const approx = new Date(`${localDate}T${localTime}:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "longOffset",
  });
  const parts = formatter.formatToParts(approx);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  // tzPart.value is like "GMT+02:00" or "GMT+01:00"
  const match = tzPart?.value.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : "+01:00";
}

/** Build an ISO string from a Europe/Paris local date + time. */
function parisToISO(localDate: string, localTime: string): string {
  const offset = parisOffset(localDate, localTime);
  return new Date(`${localDate}T${localTime}:00${offset}`).toISOString();
}
const displayDate = (date: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00Z`));
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const shiftDate = (date: string, amount: number) => {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
};
const timeOptionsFor = (opening: CalendarData["opening"]) => {
  if (!opening) return [];
  const toMinutes = (value: string) => {
    const [hour, minute] = value.slice(0, 5).split(":").map(Number);
    return hour * 60 + minute;
  };
  const start = toMinutes(opening.open_time);
  const end = toMinutes(opening.close_time);
  return Array.from(
    { length: Math.max(0, Math.floor((end - start) / 15)) + 1 },
    (_, index) => {
      const minutes = start + index * 15;
      return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    },
  );
};
const firstTimeFor = (opening: CalendarData["opening"]) =>
  timeOptionsFor(opening)[0] || "";

export default function Calendar({
  initialDate,
  businessId,
}: {
  initialDate: string;
  businessId?: string;
}) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedResource, setSelectedResource] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [block, setBlock] = useState<{
    resourceId: string;
    start: string;
  } | null>(null);
  const [label, setLabel] = useState("");
  const [duration, setDuration] = useState("30");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);
  const [addAppointmentOpen, setAddAppointmentOpen] = useState(false);

  const load = useCallback(async () => {
    const query = new URLSearchParams({ date });
    if (businessId) query.set("businessId", businessId);
    const response = await fetch(`/api/calendar?${query.toString()}`);
    if (response.status === 401) return router.replace("/login");
    const result = await response.json();
    startTransition(() => {
      setLoaded(true);
      if (!response.ok) setError(result.error);
      else {
        setData(result);
        setError("");
      }
    });
  }, [businessId, date, router]);
  useEffect(() => {
    void load();
  }, [load]);
  const resources = useMemo(
    () =>
      data?.resources.filter(
        (resource) =>
          selectedResource === "all" || resource.id === selectedResource,
      ) ?? [],
    [data, selectedResource],
  );
  const times = useMemo(
    () => timeOptionsFor(data?.opening ?? null).slice(0, -1),
    [data],
  );
  async function action(body: object) {
    const payload = businessId ? { ...body, businessId } : body;
    const response = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error);
    else {
      setBlock(null);
      setLabel("");
      await load();
      setNotice(
        body && "action" in body && body.action === "cancel"
          ? "Rendez-vous annulé."
          : body && "action" in body && body.action === "block"
            ? "Créneau bloqué."
            : "Coiffeur enregistré.",
      );
    }
  }
  const selectedAppointment =
    data?.appointments.find(
      (appointment) => appointment.id === selectedAppointmentId,
    ) ?? null;

  const confirmedAppointments = useMemo(() => {
    return (data?.appointments || []).filter(
      (item) => item.status === "confirmed" && item.booked_by !== "block",
    );
  }, [data?.appointments]);

  const phoneAppointmentsCount = useMemo(() => {
    return confirmedAppointments.filter((item) => item.booked_by === "phone").length;
  }, [confirmedAppointments]);
  async function saveAppointment(
    appointmentId: string,
    startTime: string,
    serviceId: string,
    resourceId: string,
  ) {
    const response = await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startTime, serviceId, resourceId }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error);
    else {
      setSelectedAppointmentId(null);
      await load();
      setNotice("Rendez-vous modifié.");
    }
  }
  async function cancelAppointment(appointmentId: string) {
    const response = await fetch(`/api/appointments/${appointmentId}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) setError(result.error);
    else {
      setSelectedAppointmentId(null);
      await load();
      setNotice("Rendez-vous annulé.");
    }
  }
  async function saveBlock() {
    if (block)
      await action({
        action: "block",
        resourceId: block.resourceId,
        startTime: block.start,
        durationMinutes: duration,
        label,
      });
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <Logo size={28} />
          <span className="brand-wordmark">vokalia</span>
        </div>
        <div className="actions">
          <button
            className="button primary"
            onClick={() => setAddAppointmentOpen(true)}
          >
            Ajouter un rendez-vous
          </button>
          <button
            className="button"
            onClick={() =>
              router.push(businessId ? `/${businessId}/profil` : "/profil")
            }
          >
            Profil
          </button>
          {businessId && (
            <a
              className="button ghost"
              href={`/${businessId}/profil-public`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: "none" }}
              title="Voir la fiche publique du salon"
            >
              Fiche publique ↗
            </a>
          )}
          <button
            className="button ghost"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/login");
            }}
          >
            Se déconnecter
          </button>
        </div>
      </header>
      <div className="content">
        {error && (
          <Toast message={error} type="error" onClose={() => setError("")} />
        )}
        {!error && notice && (
          <Toast
            message={notice}
            type="success"
            onClose={() => setNotice("")}
          />
        )}
        <div className="toolbar">
          <div>
            <p className="kicker">Planning du jour</p>
            <h2>{displayDate(date)}</h2>
            <p style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <span>
                {data?.opening
                  ? `${data.opening.open_time.slice(0, 5)} - ${data.opening.close_time.slice(0, 5)} · Europe/Paris`
                  : "Fermé"}
              </span>
              {confirmedAppointments.length > 0 && (
                <span style={{ color: "var(--color-text-dim)" }}>
                  · {confirmedAppointments.length} rendez-vous
                </span>
              )}
              {phoneAppointmentsCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: "var(--color-accent-soft)" }}>
                  · <WaveIndicator state="success" /> {phoneAppointmentsCount} par téléphone
                </span>
              )}
            </p>
          </div>
          <div className="actions">
            <button
              className="button"
              onClick={() => setDate(shiftDate(date, -1))}
              aria-label="Jour précédent"
            >
              ←
            </button>
            <button className="button" onClick={() => setDate(parisDate())}>
              Aujourd&apos;hui
            </button>
            <button
              className="button"
              onClick={() => setDate(shiftDate(date, 1))}
              aria-label="Jour suivant"
            >
              →
            </button>
          </div>
        </div>
        <div className="panel">
          <div className="field-row">
            <div className="field">
              <label htmlFor="resource-filter">Coiffeur</label>
              <select
                id="resource-filter"
                className="select"
                value={selectedResource}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedResource(value);
                }}
              >
                <option value="all">Tous les coiffeurs</option>
                {data?.resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <CallbackPanel businessId={businessId} onError={setError} />
        {!loaded ? (
          <div className="empty">Chargement du planning...</div>
        ) : !data?.opening ? (
          <div className="empty">Le salon est fermé ce jour-là.</div>
        ) : (
          <CompactCalendar
            times={times}
            data={data}
            resources={resources}
            selectedResource={selectedResource}
            onFree={(start) =>
              selectedResource !== "all" &&
              setBlock({ resourceId: selectedResource, start })
            }
            onOccupied={setSelectedAppointmentId}
          />
        )}
        {block && (
          <div className="panel">
            <h3>
              Bloquer le créneau de{" "}
              {
                data?.resources.find(
                  (resource) => resource.id === block.resourceId,
                )?.name
              }{" "}
              à {formatTime(block.start)}
            </h3>
            <div className="field-row">
              <div className="field">
                <label>Durée</label>
                <select
                  className="select"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 heure</option>
                  <option value="90">1 h 30</option>
                </select>
              </div>
              <div className="field">
                <label>Libellé (optionnel)</label>
                <input
                  className="input"
                  placeholder="Pause déjeuner"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </div>
              <button className="button primary" onClick={saveBlock}>
                Bloquer
              </button>
              <button className="button" onClick={() => setBlock(null)}>
                Fermer
              </button>
            </div>
          </div>
        )}
        {selectedAppointment && data && (
          <AppointmentModal
            appointment={selectedAppointment}
            opening={data.opening}
            resources={data.resources}
            services={data.services}
            onClose={() => setSelectedAppointmentId(null)}
            onSave={saveAppointment}
            onCancel={cancelAppointment}
          />
        )}
        {addAppointmentOpen && data && (
          <AddAppointmentModal
            businessId={businessId}
            date={date}
            opening={data.opening}
            resources={data.resources}
            services={data.services}
            onClose={() => setAddAppointmentOpen(false)}
            onCreated={async () => {
              await load();
              setNotice("Rendez-vous créé.");
            }}
            onError={setError}
          />
        )}
      </div>
    </main>
  );
}

function AddAppointmentModal({
  businessId,
  date: initialDate,
  opening: initialOpening,
  resources,
  services,
  onClose,
  onCreated,
  onError,
}: {
  businessId?: string;
  date: string;
  opening: CalendarData["opening"];
  resources: CalendarData["resources"];
  services: CalendarData["services"];
  onClose: () => void;
  onCreated: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [date, setDate] = useState(initialDate);
  const [opening, setOpening] = useState(initialOpening);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [resourceId, setResourceId] = useState(resources[0]?.id || "");
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [time, setTime] = useState(firstTimeFor(initialOpening));
  const [saving, setSaving] = useState(false);
  const timeOptions = timeOptionsFor(opening);

  useEffect(() => {
    if (date === initialDate) return;
    const query = new URLSearchParams({ date });
    if (businessId) query.set("businessId", businessId);
    fetch(`/api/calendar?${query.toString()}`)
      .then((response) => response.json())
      .then((result) =>
        startTransition(() => {
          const nextOpening = result.opening ?? null;
          setOpening(nextOpening);
          setTime(firstTimeFor(nextOpening));
        }),
      )
      .catch(() =>
        onError("Impossible de charger les horaires de cette date."),
      );
  }, [businessId, date, initialDate, onError]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    const startTime = parisToISO(date, time);
    const response = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName,
        customerPhone,
        resourceId,
        serviceId,
        startTime,
        ...(businessId ? { businessId } : {}),
      }),
    });
    const result = await response.json();
    if (!response.ok) onError(result.error);
    else {
      onClose();
      await onCreated();
    }
    setSaving(false);
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        className="modal"
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-appointment-title"
      >
        <div className="modal-header">
          <div>
            <p className="kicker">Nouveau rendez-vous</p>
            <h3 id="add-appointment-title">Ajouter un RDV</h3>
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
        <div className="modal-form">
          <div className="field">
            <label htmlFor="new-appointment-date">Date du rendez-vous</label>
            <input
              className="input"
              id="new-appointment-date"
              type="date"
              min={parisDate()}
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setTime("");
              }}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-customer-name">Nom du client</label>
            <input
              className="input"
              id="new-customer-name"
              required
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="new-customer-phone">Téléphone (optionnel)</label>
            <input
              className="input"
              id="new-customer-phone"
              type="tel"
              placeholder="+33..."
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="new-appointment-resource">Coiffeur</label>
            <select
              className="select"
              id="new-appointment-resource"
              required
              value={resourceId}
              onChange={(event) => setResourceId(event.target.value)}
            >
              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-appointment-service">Prestation</label>
            <select
              className="select"
              id="new-appointment-service"
              required
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
            >
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} · {service.duration_minutes} min
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="field-label">Heure</span>
            {opening ? (
              <TimePicker
                value={time || timeOptions[0] || ""}
                options={timeOptions}
                onChange={setTime}
              />
            ) : (
              <span className="modal-note">Salon fermé ce jour-là.</span>
            )}
          </div>
        </div>
        <div className="modal-actions">
          <span />
          <button type="button" className="button" onClick={onClose}>
            Fermer
          </button>
          <button
            className="button primary"
            disabled={saving || !opening || !time}
          >
            {saving ? "Création..." : "Créer le RDV"}
          </button>
        </div>
      </form>
    </div>
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
  return (
    <div className="time-picker">
      <button
        type="button"
        className="select time-picker-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {value}
      </button>
      {open && (
        <div
          className="time-picker-menu"
          role="listbox"
          aria-label="Choisir une heure"
        >
          {options.map((option) => (
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

function CompactCalendar({
  times,
  data,
  resources,
  selectedResource,
  onFree,
  onOccupied,
}: {
  times: string[];
  data: CalendarData;
  resources: CalendarData["resources"];
  selectedResource: string;
  onFree: (start: string) => void;
  onOccupied: (id: string) => void;
}) {
  const appointments = data.appointments.filter(
    (item) =>
      item.status === "confirmed" &&
      (selectedResource === "all" || item.resource_id === selectedResource),
  );
  const available = new Set(
    data.slots
      .filter(
        (slot) =>
          selectedResource === "all" || slot.resource_id === selectedResource,
      )
      .map((slot) => formatTime(slot.slot_start)),
  );
  return (
    <div className="timeline-wrap">
      <div className="legend">
        {resources.map((resource) => (
          <span className="legend-item" key={resource.id}>
            <i style={{ backgroundColor: resource.color }} />
            {resource.name}
          </span>
        ))}
      </div>
      <div className="timeline-head">
        <span>Heure</span>
        <span>Rendez-vous et disponibilités</span>
      </div>
      {times.map((time) => {
        const rowAppointments = appointments.filter(
          (item) => formatTime(item.start_time) === time,
        );
        const start = parisToISO(data.date, time);
        const canBlock =
          selectedResource !== "all" &&
          available.has(time) &&
          rowAppointments.length === 0;
        return (
          <div
            className={`timeline-row ${canBlock ? "timeline-free" : ""}`}
            key={time}
            role={canBlock ? "button" : undefined}
            tabIndex={canBlock ? 0 : undefined}
            onClick={() => canBlock && onFree(start)}
            onKeyDown={(e) => {
              if (canBlock && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onFree(start);
              }
            }}
          >
            <time>{time}</time>
            <div className="timeline-events">
              {rowAppointments.map((appointment) => {
                const resource = resources.find(
                  (item) => item.id === appointment.resource_id,
                );
                return (
                  <button
                    className={`timeline-event ${appointment.booked_by === "block" ? "timeline-block" : ""}`}
                    style={
                      {
                        "--event-color": resource?.color || "var(--color-accent)",
                      } as React.CSSProperties
                    }
                    key={appointment.id}
                    aria-label={`RDV ${appointment.booked_by === "block" ? appointment.block_label || "Indisponible" : appointment.customer?.name || "Client"} à ${time}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOccupied(appointment.id);
                    }}
                  >
                    <strong style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      {appointment.booked_by === "phone" && <WaveIndicator state="success" />}
                      {appointment.booked_by === "block"
                        ? appointment.block_label || "Indisponible"
                        : appointment.customer?.name || "Client"}
                    </strong>
                    <span>
                      {resource?.name || "Coiffeur"} ·{" "}
                      {appointment.service?.name || "Blocage"} ·{" "}
                      {formatTime(appointment.end_time)}
                    </span>
                  </button>
                );
              })}
              {rowAppointments.length === 0 && (
                <span className="timeline-empty">
                  {selectedResource === "all"
                    ? "Sélectionnez un Coiffeur pour bloquer"
                    : canBlock
                      ? "Libre · cliquer pour bloquer"
                      : "Libre"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AppointmentModal({
  appointment,
  opening,
  resources,
  services,
  onClose,
  onSave,
  onCancel,
}: {
  appointment: CalendarData["appointments"][number];
  opening: CalendarData["opening"];
  resources: CalendarData["resources"];
  services: CalendarData["services"];
  onClose: () => void;
  onSave: (
    id: string,
    startTime: string,
    serviceId: string,
    resourceId: string,
  ) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const [time, setTime] = useState(formatTime(appointment.start_time));
  const [serviceId, setServiceId] = useState(appointment.service_id || "");
  const [resourceId, setResourceId] = useState(appointment.resource_id || "");
  const [saving, setSaving] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const timeOptions = timeOptionsFor(opening);
  const resource = resources.find(
    (item) => item.id === appointment.resource_id,
  );
  const isBlock = appointment.booked_by === "block";
  async function save() {
    setSaving(true);
    await onSave(
      appointment.id,
      parisToISO(
        new Date(appointment.start_time).toISOString().slice(0, 10),
        time,
      ),
      serviceId,
      resourceId,
    );
    setSaving(false);
  }
  async function cancel() {
    setSaving(true);
    await onCancel(appointment.id);
    setSaving(false);
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-title"
      >
        <div className="modal-header">
          <div>
            <p className="kicker">Détail du rendez-vous</p>
            <h3 id="appointment-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {!isBlock && appointment.booked_by === "phone" && <WaveIndicator state="success" />}
              {isBlock
                ? appointment.block_label || "Indisponible"
                : appointment.customer?.name || "Client"}
            </h3>
          </div>
          <button
            className="button ghost"
            onClick={onClose}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div className="modal-details">
          <span>
            <b>Coiffeur</b>
            {resource?.name || "Non renseigné"}
          </span>
          <span>
            <b>Heure actuelle</b>
            {formatTime(appointment.start_time)} -{" "}
            {formatTime(appointment.end_time)}
          </span>
          {!isBlock && (
            <span>
              <b>Canal</b>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                {appointment.booked_by === "phone" ? (
                  <>
                    <WaveIndicator state="success" /> Téléphone
                  </>
                ) : appointment.booked_by === "web" ? (
                  "Réservation web"
                ) : (
                  "Saisie manuelle"
                )}
              </span>
            </span>
          )}
          {!isBlock && (
            <span>
              <b>Prestation</b>
              {appointment.service?.name || "Non renseignée"}
            </span>
          )}
        </div>
        {isBlock ? (
          <p className="modal-note">
            Ce blocage manuel n&apos;a pas de client ni de prestation.
          </p>
        ) : (
          <div className="modal-form">
            <div className="field">
              <label htmlFor="appointment-resource">Coiffeur</label>
              <select
                className="select"
                id="appointment-resource"
                value={resourceId}
                onChange={(event) => setResourceId(event.target.value)}
              >
                {resources.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span className="field-label">Nouvelle heure</span>
              <TimePicker
                value={time}
                options={timeOptions}
                onChange={setTime}
              />
            </div>
            <div className="field">
              <label htmlFor="appointment-service">Prestation</label>
              <select
                className="select"
                id="appointment-service"
                value={serviceId}
                onChange={(event) => setServiceId(event.target.value)}
              >
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name} · {service.duration_minutes} min
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {confirmCancel && (
          <div className="confirm-box">
            <strong>Annuler définitivement ce rendez-vous ?</strong>
            <span>
              L&apos;historique sera conservé et le créneau redeviendra
              disponible.
            </span>
            <div className="actions">
              <button
                className="button"
                onClick={() => setConfirmCancel(false)}
              >
                Retour
              </button>
              <button
                className="button danger"
                disabled={saving}
                onClick={cancel}
              >
                Confirmer l&apos;annulation
              </button>
            </div>
          </div>
        )}
        <div className="modal-actions">
          {!confirmCancel && (
            <button
              className="button danger"
              onClick={() => setConfirmCancel(true)}
            >
              Annuler le rendez-vous
            </button>
          )}
          <span />
          <button className="button" onClick={onClose}>
            Fermer
          </button>
          {!isBlock && !confirmCancel && (
            <button
              className="button primary"
              disabled={saving || !serviceId || !resourceId}
              onClick={save}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
