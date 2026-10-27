"use client";

import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import type { CalendarData } from "@/lib/types";
import { SLOT_STEP_MINUTES } from "@/lib/constants";
import Toast from "@/app/components/toast";
import Icon from "@/app/components/Icon";
import DashboardShell from "@/app/components/DashboardShell";
import WaveIndicator from "@/app/components/WaveIndicator";
import { useRouter } from "next/navigation";
import CallbackPanel from "@/app/components/CallbackPanel";
import { useModalFocusTrap } from "@/app/components/Modal";

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
const formatTime = (value: string) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};
const shiftDate = (date: string, amount: number) => {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
};
const toMinutes = (value: string) => {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
};

const ROW_HEIGHT = 44; // Hauteur en pixels d'une ligne de 30 minutes

const timeOptionsFor = (opening: CalendarData["opening"]) => {
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
  const [appointmentDraft, setAppointmentDraft] = useState<{
    resourceId: string;
    start: string;
  } | null>(null);
  const blockTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!block) blockTriggerRef.current?.focus();
  }, [block]);

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

  const isToday = date === parisDate();

  const nextAppointment = useMemo(() => {
    if (!confirmedAppointments.length) return null;
    const nowTime = new Date().getTime();
    const sorted = [...confirmedAppointments].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
    );
    if (isToday) {
      const upcoming = sorted.find((a) => new Date(a.start_time).getTime() >= nowTime);
      return upcoming || sorted[0];
    }
    return sorted[0];
  }, [confirmedAppointments, isToday]);

  const summaryLine = useMemo(() => {
    if (confirmedAppointments.length === 0) {
      return isToday ? "0 rendez-vous aujourd'hui" : `0 rendez-vous le ${displayDate(date)}`;
    }
    const countStr = `${confirmedAppointments.length} rendez-vous ${isToday ? "aujourd'hui" : ""}`.trim();
    if (nextAppointment) {
      const timeStr = formatTime(nextAppointment.start_time);
      const clientName = nextAppointment.customer?.name || "Client";
      return `${countStr} · prochain à ${timeStr} (${clientName})`;
    }
    return countStr;
  }, [confirmedAppointments, isToday, nextAppointment, date]);

  const currentOrNextRowTime = useMemo(() => {
    if (!isToday || !times.length) return null;
    if (nextAppointment) {
      const apptTime = formatTime(nextAppointment.start_time);
      const apptMinutes = toMinutes(apptTime);
      const matchingSlot = [...times].reverse().find((t) => toMinutes(t) <= apptMinutes);
      return matchingSlot || times[0];
    }
    const nowParis = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date());
    const slot = [...times].reverse().find((t) => t <= nowParis);
    return slot || times[0];
  }, [isToday, times, nextAppointment]);

  async function saveAppointment(
    appointmentId: string,
    startTime: string,
    serviceId: string,
    resourceId: string,
  ) {
    const response = await fetch(`/api/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startTime,
        serviceId,
        resourceId,
        ...(businessId ? { businessId } : {}),
      }),
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
    const qs = businessId ? `?businessId=${businessId}` : "";
    const response = await fetch(`/api/appointments/${appointmentId}${qs}`, {
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
    <DashboardShell
      businessId={businessId}
      onAddAppointment={() => setAddAppointmentOpen(true)}
    >
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

        <CallbackPanel businessId={businessId} onError={setError} compact />

        {/* Sticky Header: Navigation date, Résumé 1 ligne & Filtre praticien */}
        <div className="sticky top-0 z-20 bg-[var(--color-bg)]/95 backdrop-blur-md pt-2 pb-3 mb-4 border-b border-[var(--color-border)]">
          <div className="toolbar !m-0 !p-0">
            <div>
              <p className="kicker">Planning du jour</p>
              <h2 className="capitalize">{displayDate(date)}</h2>
              <p className="text-sm font-medium text-[var(--color-accent-soft)] flex items-center gap-2 mt-1">
                <span>{summaryLine}</span>
                {phoneAppointmentsCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-dim)] bg-[var(--color-bg-subtle)] px-2 py-0.5 rounded-full">
                    <WaveIndicator state="success" /> {phoneAppointmentsCount} par téléphone
                  </span>
                )}
              </p>
            </div>
            <div className="actions flex items-center gap-2">
              <button
                className="button min-w-[44px] min-h-[44px]"
                onClick={() => setDate(shiftDate(date, -1))}
                aria-label="Jour précédent"
              >
                ←
              </button>
              <button
                className={`button min-h-[44px] ${isToday ? "primary font-semibold" : ""}`}
                onClick={() => setDate(parisDate())}
              >
                Aujourd&apos;hui
              </button>
              <button
                className="button min-w-[44px] min-h-[44px]"
                onClick={() => setDate(shiftDate(date, 1))}
                aria-label="Jour suivant"
              >
                →
              </button>
            </div>
          </div>

          {/* Filtres & Statut salon */}
          <div className="mt-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label htmlFor="resource-filter" className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Coiffeur :
              </label>
              <select
                id="resource-filter"
                className="select !py-1.5 !px-3 text-sm min-h-[40px]"
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

            <div className="text-xs text-[var(--color-text-dim)]">
              {data?.opening
                ? `${data.opening.open_time.slice(0, 5)} - ${data.opening.close_time.slice(0, 5)} · Europe/Paris`
                : "Salon fermé"}
            </div>
          </div>
        </div>

        {!loaded ? (
          <div className="flex flex-col gap-4 mt-4 animate-pulse">
             <div className="h-10 bg-[var(--color-bg-panel)] rounded-xl w-1/3"></div>
             <div className="h-24 bg-[var(--color-bg-panel)] rounded-xl w-full"></div>
             <div className="h-24 bg-[var(--color-bg-panel)] rounded-xl w-full"></div>
             <div className="h-24 bg-[var(--color-bg-panel)] rounded-xl w-full"></div>
          </div>
        ) : data?.resources.length === 0 || data?.services.length === 0 ? (
          <div className="empty flex flex-col items-center justify-center text-center p-8 gap-4 border border-dashed border-[var(--color-border)] rounded-xl mt-4">
            <span className="text-[var(--color-accent)]"><Icon name="sparkles" size={36} /></span>
            <h3 className="m-0 text-lg">Bienvenue sur votre planning</h3>
            <p className="text-[var(--color-text-muted)] max-w-md m-0">
              Pour commencer à recevoir des rendez-vous, ajoutez au moins un coiffeur et une prestation dans vos réglages.
            </p>
            <button 
              className="button primary mt-2" 
              onClick={() => router.push(businessId ? `/${businessId}/profil` : "/profil")}
            >
              Configurer mon salon
            </button>
          </div>
        ) : !data?.opening ? (
          <div className="empty">Le salon est fermé ce jour-là.</div>
        ) : (
          <CompactCalendar
            times={times}
            data={data}
            resources={resources}
            selectedResource={selectedResource}
            targetTime={currentOrNextRowTime}
            onFree={(resId, start, trigger) => {
              blockTriggerRef.current = trigger;
              setBlock({ resourceId: resId, start });
            }}
            onOccupied={setSelectedAppointmentId}
          />
        )}
        {block && data && (
          <BlockAppointmentModal
            block={block}
            resourceName={data.resources.find((resource) => resource.id === block.resourceId)?.name || "Coiffeur"}
            duration={duration}
            label={label}
            onDurationChange={setDuration}
            onLabelChange={setLabel}
            onSave={saveBlock}
            onClose={() => setBlock(null)}
            onBook={() => {
              setAppointmentDraft(block);
              setBlock(null);
              setAddAppointmentOpen(true);
            }}
          />
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
            initialResourceId={appointmentDraft?.resourceId}
            initialTime={appointmentDraft ? formatTime(appointmentDraft.start) : undefined}
            opening={data.opening}
            resources={data.resources}
            services={data.services}
            onClose={() => {
              setAddAppointmentOpen(false);
              setAppointmentDraft(null);
            }}
            onCreated={async () => {
              await load();
              setNotice("Rendez-vous créé.");
            }}
            onError={setError}
          />
        )}
      </DashboardShell>
  );
}

function AddAppointmentModal({
  businessId,
  date: initialDate,
  initialResourceId,
  initialTime,
  opening: initialOpening,
  resources,
  services,
  onClose,
  onCreated,
  onError,
}: {
  businessId?: string;
  date: string;
  initialResourceId?: string;
  initialTime?: string;
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
  const [resourceId, setResourceId] = useState(initialResourceId || resources[0]?.id || "");
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [time, setTime] = useState(initialTime || firstTimeFor(initialOpening));
  const [saving, setSaving] = useState(false);
  const timeOptions = timeOptionsFor(opening);
  
  const modalRef = useRef<HTMLFormElement>(null);
  useModalFocusTrap(modalRef, onClose);

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
        ref={modalRef}
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
        {value}
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

function BlockAppointmentModal({
  block,
  resourceName,
  duration,
  label,
  onDurationChange,
  onLabelChange,
  onSave,
  onClose,
  onBook,
}: {
  block: { resourceId: string; start: string };
  resourceName: string;
  duration: string;
  label: string;
  onDurationChange: (value: string) => void;
  onLabelChange: (value: string) => void;
  onSave: () => Promise<void>;
  onClose: () => void;
  onBook: () => void;
}) {
  const modalRef = useRef<HTMLElement>(null);
  useModalFocusTrap(modalRef, onClose);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await onSave();
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-appointment-title"
      >
        <div className="modal-header">
          <div>
            <p className="kicker">Blocage manuel</p>
            <h3 id="block-appointment-title">Bloquer le créneau</h3>
            <p className="modal-note">{resourceName} · {formatTime(block.start)}</p>
          </div>
          <button type="button" className="button ghost" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <form className="modal-form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="block-duration">Durée</label>
            <select
              id="block-duration"
              className="select"
              value={duration}
              onChange={(event) => onDurationChange(event.target.value)}
            >
              <option value="30">30 minutes</option>
              <option value="60">1 heure</option>
              <option value="90">1 h 30</option>
              <option value="120">2 heures</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="block-label">Libellé (optionnel)</label>
            <input
              id="block-label"
              className="input"
              placeholder="Pause déjeuner"
              value={label}
              onChange={(event) => onLabelChange(event.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="button ghost" onClick={onBook}>
              Prendre un rendez-vous
            </button>
            <span />
            <button type="button" className="button" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="button primary">
              Bloquer
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CompactCalendar({
  times,
  data,
  resources,
  selectedResource,
  targetTime,
  onFree,
  onOccupied,
}: {
  times: string[];
  data: CalendarData;
  resources: CalendarData["resources"];
  selectedResource: string;
  targetTime?: string | null;
  onFree: (resourceId: string, start: string, trigger: HTMLElement) => void;
  onOccupied: (id: string) => void;
}) {
  const targetRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (targetRowRef.current) {
      const el = targetRowRef.current;
      const timer = setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [targetTime]);

  const appointments = data.appointments.filter(
    (item) =>
      item.status === "confirmed" &&
      (selectedResource === "all" || item.resource_id === selectedResource),
  );

  const isMultiColumn = selectedResource === "all" && resources.length > 1;

  return (
    <div className="timeline-wrap">
      {/* Legend */}
      <div className="legend flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-3">
          {resources.map((resource) => (
            <span className="legend-item" key={resource.id}>
              <i style={{ backgroundColor: resource.color }} />
              {resource.name}
            </span>
          ))}
        </div>
        {selectedResource === "all" && (
          <span className="text-xs text-[var(--color-text-muted)] italic">
            Sélectionnez un coiffeur pour bloquer un créneau.
          </span>
        )}
      </div>

      {/* Multi-column view for Desktop when "all" is selected */}
      {isMultiColumn ? (
        <>
          {/* Desktop view (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `5rem repeat(${resources.length}, minmax(130px, 1fr))`,
              }}
            >
              {/* Sticky column headers */}
              <div className="sticky top-0 z-10 bg-[var(--color-bg-panel-2)] p-2 text-xs font-semibold text-[var(--color-text-muted)] border-b border-r border-[var(--color-border)] text-center">
                Heure
              </div>
              {resources.map((res) => (
                <div
                  key={res.id}
                  className="sticky top-0 z-10 bg-[var(--color-bg-panel-2)] p-2 text-xs font-bold text-[var(--color-text)] border-b border-r border-[var(--color-border)] last:border-r-0 flex items-center justify-center gap-1.5"
                  style={{ borderTop: `3px solid ${res.color}` }}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: res.color }} />
                  <span className="truncate">{res.name}</span>
                </div>
              ))}

              {/* Grid content rows */}
              {times.map((time, timeIndex) => {
                const isTarget = time === targetTime;
                const start = parisToISO(data.date, time);
                const slotStart = new Date(start).getTime();
                const slotEnd = slotStart + SLOT_STEP_MINUTES * 60_000;
                const slotStartMin = toMinutes(time);
                const slotEndMin = slotStartMin + SLOT_STEP_MINUTES;

                return (
                  <React.Fragment key={time}>
                    <div
                      ref={isTarget ? targetRowRef : undefined}
                      className={`border-b border-r border-[var(--color-border)] p-1.5 text-xs text-[var(--color-text-muted)] flex items-center justify-center font-mono ${
                        isTarget ? "bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] font-bold text-[var(--color-accent)]" : ""
                      }`}
                      style={{ height: `${ROW_HEIGHT}px` }}
                    >
                      {time}
                    </div>

                    {resources.map((res) => {
                      const displayedAppointments = appointments.filter((item) => {
                        if (item.resource_id !== res.id) return false;
                        const apptMin = toMinutes(formatTime(item.start_time));
                        if (timeIndex === 0 && apptMin < slotStartMin) return true;
                        return apptMin >= slotStartMin && apptMin < slotEndMin;
                      });
                      const occupiedAppointments = appointments.filter((item) => {
                        const appointmentStart = new Date(item.start_time).getTime();
                        const appointmentEnd = new Date(item.end_time).getTime();
                        return item.resource_id === res.id && appointmentStart < slotEnd && appointmentEnd > slotStart;
                      });
                      const isFree = occupiedAppointments.length === 0;

                      return (
                        <div
                          key={res.id}
                          className={`relative border-b border-r border-[var(--color-border)] last:border-r-0 p-0.5 flex items-center group transition-colors ${
                            isFree ? "hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-bg-panel))] cursor-pointer" : ""
                          }`}
                          style={{ height: `${ROW_HEIGHT}px` }}
                          role={isFree ? "button" : undefined}
                          tabIndex={isFree ? 0 : undefined}
                          onClick={(event) => isFree && onFree(res.id, start, event.currentTarget)}
                          onKeyDown={(event) => {
                            if (isFree && (event.key === "Enter" || event.key === " ")) {
                              event.preventDefault();
                              onFree(res.id, start, event.currentTarget);
                            }
                          }}
                          aria-label={isFree ? `Bloquer ${res.name} à ${time}` : undefined}
                        >
                          <div className="timeline-appointment-layer">
                          {displayedAppointments.map((appt) => {
                            const apptMin = toMinutes(formatTime(appt.start_time));
                            const offsetMin = Math.max(0, apptMin - slotStartMin);
                            const topPx = (offsetMin / SLOT_STEP_MINUTES) * ROW_HEIGHT + 2;
                            const durationMin =
                              Math.round(
                                (new Date(appt.end_time).getTime() - new Date(appt.start_time).getTime()) /
                                  60000,
                              ) || SLOT_STEP_MINUTES;
                            const heightPx = Math.max(18, (durationMin / SLOT_STEP_MINUTES) * ROW_HEIGHT - 4);
                            const isBlock = appt.booked_by === "block";

                            return (
                              <button
                                key={appt.id}
                                type="button"
                                className="absolute inset-x-0.5 z-10 p-1 rounded text-left text-xs transition-all overflow-hidden shadow-xs cursor-pointer border-l-3"
                                style={{
                                  top: `${topPx}px`,
                                  height: `${heightPx}px`,
                                  borderLeftColor: res.color,
                                  backgroundColor: `color-mix(in srgb, ${res.color} 18%, var(--color-bg-panel))`,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOccupied(appt.id);
                                }}
                                aria-label={`RDV ${isBlock ? appt.block_label || "Indisponible" : appt.customer?.name || "Client"} à ${formatTime(appt.start_time)}`}
                                title={`${isBlock ? appt.block_label || "Indisponible" : appt.customer?.name || "Client"} · ${formatTime(appt.start_time)} - ${formatTime(appt.end_time)}`}
                              >
                                <div className="font-semibold truncate flex items-center gap-1 text-[var(--color-text)] leading-tight text-[11px]">
                                  {appt.booked_by === "phone" && <WaveIndicator state="success" />}
                                  <span className="truncate">{isBlock ? appt.block_label || "Indisponible" : appt.customer?.name || "Client"}</span>
                                </div>
                                {durationMin >= 25 && (
                                  <div className="text-[10px] text-[var(--color-text-muted)] truncate leading-tight">
                                    {appt.service?.name || "Blocage"} · {formatTime(appt.start_time)} - {formatTime(appt.end_time)}
                                  </div>
                                )}
                              </button>
                            );
                          })}
                          </div>
                          {isFree && (
                            <span className="opacity-0 group-hover:opacity-100 text-[var(--color-accent)] text-xs font-semibold mx-auto transition-opacity">
                              +
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Mobile view (< 768px): single column list */}
          <div className="block md:hidden">
            <div className="timeline-head">
              <span>Heure</span>
              <span>Rendez-vous et disponibilités</span>
            </div>
            {times.map((time, timeIndex) => {
              const slotStartMin = toMinutes(time);
              const slotEndMin = slotStartMin + SLOT_STEP_MINUTES;
              const rowAppointments = appointments.filter((item) => {
                const apptMin = toMinutes(formatTime(item.start_time));
                if (timeIndex === 0 && apptMin < slotStartMin) return true;
                return apptMin >= slotStartMin && apptMin < slotEndMin;
              });
              const isTarget = time === targetTime;

              return (
                <div
                  ref={isTarget ? targetRowRef : undefined}
                  className={`timeline-row ${isTarget ? "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]" : ""}`}
                  style={{ minHeight: `${ROW_HEIGHT}px` }}
                  key={time}
                >
                  <time>{time}</time>
                  <div className="timeline-events">
                    {rowAppointments.map((appointment) => {
                      const resource = resources.find(
                        (item) => item.id === appointment.resource_id,
                      );
                      const durationMin =
                        Math.round(
                          (new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) /
                            60000,
                        ) || SLOT_STEP_MINUTES;
                      const isBlock = appointment.booked_by === "block";

                      return (
                        <button
                          className={`timeline-event ${isBlock ? "timeline-block" : ""}`}
                          style={
                            {
                              "--event-color": resource?.color || "var(--color-accent)",
                            } as React.CSSProperties
                          }
                          key={appointment.id}
                          aria-label={`RDV ${isBlock ? appointment.block_label || "Indisponible" : appointment.customer?.name || "Client"} à ${formatTime(appointment.start_time)}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onOccupied(appointment.id);
                          }}
                        >
                          <strong style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                            {appointment.booked_by === "phone" && <WaveIndicator state="success" />}
                            {isBlock
                              ? appointment.block_label || "Indisponible"
                              : appointment.customer?.name || "Client"}
                          </strong>
                          <span>
                            {formatTime(appointment.start_time)} · {resource?.name || "Coiffeur"} · {appointment.service?.name || "Blocage"} ({durationMin} min)
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Single column view (filtered by specific resource) */
        <div>
          <div className="timeline-head">
            <span>Heure</span>
            <span>Rendez-vous et disponibilités</span>
          </div>
          {times.map((time, timeIndex) => {
            const start = parisToISO(data.date, time);
            const slotStart = new Date(start).getTime();
            const slotEnd = slotStart + SLOT_STEP_MINUTES * 60_000;
            const slotStartMin = toMinutes(time);
            const slotEndMin = slotStartMin + SLOT_STEP_MINUTES;
            const displayedAppointments = appointments.filter((item) => {
              if (item.resource_id !== selectedResource) return false;
              const apptMin = toMinutes(formatTime(item.start_time));
              if (timeIndex === 0 && apptMin < slotStartMin) return true;
              return apptMin >= slotStartMin && apptMin < slotEndMin;
            });
            const occupiedAppointments = appointments.filter((item) => {
              const appointmentStart = new Date(item.start_time).getTime();
              const appointmentEnd = new Date(item.end_time).getTime();
              return item.resource_id === selectedResource && appointmentStart < slotEnd && appointmentEnd > slotStart;
            });
            const canBlock = selectedResource !== "all" && occupiedAppointments.length === 0;
            const isTarget = time === targetTime;

            return (
              <div
                ref={isTarget ? targetRowRef : undefined}
                className={`timeline-row group ${canBlock ? "timeline-free" : ""} ${
                  isTarget ? "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]" : ""
                }`}
                style={{ minHeight: `${ROW_HEIGHT}px` }}
                key={time}
                role={canBlock ? "button" : undefined}
                tabIndex={canBlock ? 0 : undefined}
                onClick={(event) => canBlock && onFree(selectedResource, start, event.currentTarget)}
                onKeyDown={(e) => {
                  if (canBlock && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onFree(selectedResource, start, e.currentTarget);
                  }
                }}
              >
                <time>{time}</time>
                <div className="timeline-events justify-between">
                  {displayedAppointments.map((appointment) => {
                    const resource = resources.find(
                      (item) => item.id === appointment.resource_id,
                    );
                    const durationMin =
                      Math.round(
                        (new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime()) /
                          60000,
                      ) || SLOT_STEP_MINUTES;
                    const isBlock = appointment.booked_by === "block";

                    return (
                      <button
                        className={`timeline-event ${isBlock ? "timeline-block" : ""}`}
                        style={
                          {
                            "--event-color": resource?.color || "var(--color-accent)",
                          } as React.CSSProperties
                        }
                        key={appointment.id}
                        aria-label={`RDV ${isBlock ? appointment.block_label || "Indisponible" : appointment.customer?.name || "Client"} à ${formatTime(appointment.start_time)}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOccupied(appointment.id);
                        }}
                      >
                        <strong style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          {appointment.booked_by === "phone" && <WaveIndicator state="success" />}
                          {isBlock
                            ? appointment.block_label || "Indisponible"
                            : appointment.customer?.name || "Client"}
                        </strong>
                        <span>
                          {formatTime(appointment.start_time)} · {resource?.name || "Coiffeur"} · {appointment.service?.name || "Blocage"} ({durationMin} min)
                        </span>
                      </button>
                    );
                  })}
                  {displayedAppointments.length === 0 && canBlock && (
                    <span className="opacity-0 group-hover:opacity-100 text-[var(--color-accent)] text-xs font-semibold px-2 transition-opacity">
                      + Bloquer ce créneau
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  
  const modalRef = useRef<HTMLElement>(null);
  useModalFocusTrap(modalRef, onClose);

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
        ref={modalRef}
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
