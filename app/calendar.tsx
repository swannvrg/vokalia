"use client";

import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import Link from "next/link";
import type { CalendarData } from "@/lib/types";
import { SLOT_STEP_MINUTES } from "@/lib/constants";
import Toast from "@/app/components/toast";
import Icon from "@/app/components/Icon";
import DashboardShell from "@/app/components/DashboardShell";
import WaveIndicator from "@/app/components/WaveIndicator";
import { useTransitionRouter, usePageReady } from "@/app/components/PageTransitionProvider";
import CallbackPanel from "@/app/components/CallbackPanel";
import CalendarModal, { type CalendarModalMode } from "@/app/components/CalendarModal";

const parisDate = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
    new Date(),
  );

/**
 * Compute the UTC offset string (e.g. "+02:00" or "+01:00") for Europe/Paris
 * at a given local date and time. Handles CET/CEST transitions automatically.
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

export default function Calendar({
  initialDate,
  businessId,
}: {
  initialDate: string;
  businessId?: string;
}) {
  const router = useTransitionRouter();
  const signalReady = usePageReady();
  const [date, setDate] = useState(initialDate);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [selectedResource, setSelectedResource] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Modale unifiée pour la création (créneau vide / bouton ajouter) et la vue détails / édition
  const [activeModal, setActiveModal] = useState<CalendarModalMode | null>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);

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
    signalReady();
  }, [businessId, date, router, signalReady]);

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

  return (
    <DashboardShell
      businessId={businessId}
      onAddAppointment={() => setActiveModal({ type: "create" })}
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
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-[var(--color-accent-soft)]">
                  <WaveIndicator state="success" />
                  {phoneAppointmentsCount} par l&apos;IA
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
              <Icon name="chevron-left" />
            </button>
            <button
              className="button"
              onClick={() => setDate(parisDate())}
            >
              Aujourd&apos;hui
            </button>
            <button
              className="button"
              onClick={() => setDate(shiftDate(date, 1))}
              aria-label="Jour suivant"
            >
              <Icon name="chevron-right" />
            </button>
            <label htmlFor="calendar-date-input" className="sr-only">Choisir une date</label>
            <input
              id="calendar-date-input"
              className="input"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            {data && data.resources.length > 1 && (
              <>
                <label htmlFor="resource-filter" className="sr-only">Filtrer par Coiffeur</label>
                <select
                  id="resource-filter"
                  className="select"
                  value={selectedResource}
                  onChange={(event) => setSelectedResource(event.target.value)}
                >
                  <option value="all">Tous les coiffeurs</option>
                  {data.resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button
              className="button primary"
              onClick={() => setActiveModal({ type: "create" })}
            >
              + Nouveau créneau
            </button>
          </div>
        </div>
      </div>

      {!loaded ? (
        <div className="empty">Chargement du calendrier...</div>
      ) : !data?.resources.length ? (
        <div className="panel p-8 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] flex items-center justify-center text-[var(--color-accent)] mb-1">
            <Icon name="user" size={24} />
          </div>
          <h3 className="text-xl font-medium text-[var(--color-text)] m-0">
            Aucun coiffeur actif
          </h3>
          <p className="text-[var(--color-text-muted)] max-w-md m-0">
            Au moins un coiffeur doit rester actif pour afficher le planning et recevoir des rendez-vous.
          </p>
          <Link
            href={businessId ? `/${businessId}/profil` : "/profil"}
            className="button primary mt-2 inline-flex items-center gap-2"
          >
            <span>Profil &gt; Coiffeurs</span>
          </Link>
        </div>
      ) : !data?.services.length ? (
        <div className="panel p-8 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] flex items-center justify-center text-[var(--color-accent)] mb-1">
            <Icon name="settings" size={24} />
          </div>
          <h3 className="text-xl font-medium text-[var(--color-text)] m-0">
            Configurez votre salon
          </h3>
          <p className="text-[var(--color-text-muted)] max-w-md m-0">
            Pour commencer à recevoir des rendez-vous, ajoutez au moins une prestation dans vos réglages.
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
            modalTriggerRef.current = trigger;
            setActiveModal({
              type: "create",
              initialResourceId: resId,
              initialTime: formatTime(start),
            });
          }}
          onOccupied={(id, trigger) => {
            modalTriggerRef.current = trigger;
            setActiveModal({
              type: "view",
              appointmentId: id,
            });
          }}
        />
      )}

      {/* Modale unifiée pour créneau vide, détail ou édition */}
      {activeModal && data && (
        <CalendarModal
          mode={activeModal}
          businessId={businessId}
          currentDate={date}
          opening={data.opening}
          resources={data.resources}
          services={data.services}
          appointments={data.appointments}
          onClose={() => {
            setActiveModal(null);
            setTimeout(() => modalTriggerRef.current?.focus(), 50);
          }}
          onRefresh={load}
          onSuccessNotice={(msg) => setNotice(msg)}
        />
      )}
    </DashboardShell>
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
  onOccupied: (id: string, trigger: HTMLElement) => void;
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
        <span className="text-xs text-[var(--color-text-muted)] italic">
          Cliquez sur un créneau libre pour créer un rendez-vous ou bloquer l&apos;horaire.
        </span>
      </div>

      {/* Grid view for Desktop (>= 768px, N columns) */}
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
                  className={`border-b border-r border-[var(--color-border)] p-1.5 text-xs text-[var(--color-text-muted)] flex items-center justify-center font-mono ${isTarget ? "bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] font-bold text-[var(--color-accent)]" : ""
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
                      className={`relative border-b border-r border-[var(--color-border)] last:border-r-0 p-0.5 flex items-center group transition-colors ${isFree ? "hover:bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-bg-panel))] cursor-pointer" : ""
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
                      aria-label={isFree ? `Créneau libre pour ${res.name} à ${time}. Cliquez pour ajouter un RDV ou bloquer.` : undefined}
                    >
                      <div className="timeline-appointment-layer" style={{ pointerEvents: "none", width: "100%", height: "100%" }}>
                        {displayedAppointments.map((appt) => {
                          const apptMin = toMinutes(formatTime(appt.start_time));
                          const offsetMin = Math.max(0, apptMin - slotStartMin);
                          const topPx = (offsetMin / SLOT_STEP_MINUTES) * ROW_HEIGHT + 2;
                          const durationMin =
                            Math.round(
                              (new Date(appt.end_time).getTime() - new Date(appt.start_time).getTime()) /
                              60000,
                            ) || SLOT_STEP_MINUTES;
                          const heightPx = Math.max(22, (durationMin / SLOT_STEP_MINUTES) * ROW_HEIGHT - 4);
                          const isBlock = appt.booked_by === "block";

                          return (
                            <button
                              key={appt.id}
                              type="button"
                              className="absolute inset-x-0.5 z-10 p-1.5 rounded text-left text-xs transition-all overflow-hidden shadow-xs cursor-pointer border-l-3 pointer-events-auto"
                              style={{
                                top: `${topPx}px`,
                                height: `${heightPx}px`,
                                borderLeftColor: res.color,
                                backgroundColor: `color-mix(in srgb, ${res.color} 18%, var(--color-bg-panel))`,
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onOccupied(appt.id, e.currentTarget);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onOccupied(appt.id, e.currentTarget);
                                }
                              }}
                              aria-label={`${isBlock ? "Blocage" : "Rendez-vous"} de ${isBlock ? appt.block_label || "Indisponible" : appt.customer?.name || "Client"} à ${formatTime(appt.start_time)}`}
                              title={`${isBlock ? appt.block_label || "Indisponible" : appt.customer?.name || "Client"} · ${formatTime(appt.start_time)} - ${formatTime(appt.end_time)}`}
                            >
                              <div className="font-semibold truncate flex items-center gap-1 text-[var(--color-text)] leading-tight text-[11px]">
                                {appt.booked_by === "phone" && <WaveIndicator state="success" />}
                                <span className="truncate">{isBlock ? appt.block_label || "Indisponible" : appt.customer?.name || "Client"}</span>
                              </div>
                              {durationMin >= 25 && (
                                <div className="text-[10px] text-[var(--color-text-muted)] truncate leading-tight mt-0.5">
                                  {appt.service?.name || "Blocage"} · {formatTime(appt.start_time)} - {formatTime(appt.end_time)}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {isFree && (
                        <span className="opacity-0 group-hover:opacity-100 text-[var(--color-accent)] text-xs font-semibold mx-auto transition-opacity pointer-events-none">
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
          const start = parisToISO(data.date, time);
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
                      type="button"
                      className={`timeline-event ${isBlock ? "timeline-block" : ""}`}
                      style={
                        {
                          "--event-color": resource?.color || "var(--color-accent)",
                        } as React.CSSProperties
                      }
                      key={appointment.id}
                      aria-label={`${isBlock ? "Blocage" : "RDV"} ${isBlock ? appointment.block_label || "Indisponible" : appointment.customer?.name || "Client"} à ${formatTime(appointment.start_time)}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOccupied(appointment.id, event.currentTarget);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onOccupied(appointment.id, e.currentTarget);
                        }
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
                {rowAppointments.length === 0 && (
                  <button
                    type="button"
                    className="timeline-empty-btn text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] py-1 px-2 rounded transition-colors"
                    onClick={(event) => {
                      onFree(resources[0]?.id || "", start, event.currentTarget);
                    }}
                  >
                    + Créneau libre
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
