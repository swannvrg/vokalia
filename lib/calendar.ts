import type { Appointment, CalendarData, Resource, Service } from "@/lib/types";
import { SLOT_STEP_MINUTES } from "@/lib/constants";

const PARIS_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function isParisDate(value: string | null | undefined, date: string) {
  if (!value) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    console.log("Date invalide :", JSON.stringify(value));
    return false;
  }
  return PARIS_DATE.format(d) === date;
}

export async function getCalendarData(
  supabase: ReturnType<typeof import("@/lib/supabase").createSupabaseAdminClient>,
  date: string,
  businessId: string,
): Promise<CalendarData> {
  const { data: resourceRows, error: resourcesError } = await supabase
    .from("resources")
    .select("id, business_id, name, capacity, active, color")
    .eq("business_id", businessId)
    .eq("resource_type", "practitioner")
    .eq("active", true)
    .order("name");
  if (resourcesError) throw resourcesError;

  const resources = (resourceRows ?? []) as (Resource & { business_id: string })[];
  const mondayBasedWeekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const [{ data: businessHours, error: hoursError }, { data: serviceRows, error: servicesError }, { data: appointmentRows, error: appointmentsError }] =
    await Promise.all([
      supabase.from("business_hours").select("day_of_week, open_time, close_time").eq("business_id", businessId),
      supabase.from("services").select("id, name, duration_minutes").eq("business_id", businessId).eq("active", true).order("name"),
      supabase
        .from("appointments")
        .select("id, resource_id, service_id, customer_id, start_time, end_time, status, booked_by, block_label, customer:customers(name, phone_number), service:services(name, duration_minutes, price), resource:resources(name, color)")
        .eq("business_id", businessId)
        .gte("start_time", `${date}T00:00:00Z`)
        .lt("start_time", `${date}T23:59:59Z`),
    ]);
  if (servicesError) throw servicesError;
  if (appointmentsError) throw appointmentsError;
  if (hoursError) throw hoursError;

  const normalizedHours = (businessHours ?? []).map((item) => ({
    ...item,
    day_of_week: Number(item.day_of_week),
  }));
  const usesZeroBasedWeekdays = normalizedHours.some((item) => item.day_of_week === 0);
  const hours = normalizedHours.find((item) => item.day_of_week === (usesZeroBasedWeekdays ? mondayBasedWeekday : mondayBasedWeekday + 1)) ?? null;

  const services = (serviceRows ?? []) as Service[];
  const appointments = (appointmentRows ?? []).map((item) => ({
    ...item,
    customer: Array.isArray(item.customer) ? item.customer[0] ?? null : item.customer,
    service: Array.isArray(item.service) ? item.service[0] ?? null : item.service,
    resource: Array.isArray(item.resource) ? item.resource[0] ?? null : item.resource,
  })) as Appointment[];
  const slotResults = await Promise.all(
    services.flatMap((service) =>
      resources.map(async (resource) => {
        const { data, error } = await supabase.rpc("get_available_slots", {
          p_business_id: businessId,
          p_service_id: service.id,
          p_resource_id: resource.id,
          p_party_size: "1",
          p_search_from: `${date}T00:00:00Z`,
          p_search_days: 2,
          p_slot_increment_minutes: SLOT_STEP_MINUTES,
          p_max_results: 500,
        });
        if (error) throw error;
        return (data ?? [])
        .map((slot: {
          resource_id: string;
          slot_start?: string;
          slot_end?: string;
          slot_display?: string;
          slot_token?: string;
        }) => {
          let slotStart = slot.slot_start;
          if (!slotStart && slot.slot_token) {
            try {
              const decoded = Buffer.from(slot.slot_token, "base64").toString("utf-8");
              const parts = decoded.split("|");
              if (parts[1]) {
                const d = new Date(parts[1].trim());
                if (!Number.isNaN(d.getTime())) slotStart = d.toISOString();
              }
            } catch {
              // ignore
            }
          }
          if (!slotStart && slot.slot_display) {
            const d = new Date(slot.slot_display);
            if (!Number.isNaN(d.getTime())) slotStart = d.toISOString();
          }
          const slotEnd =
            slot.slot_end ||
            (slotStart
              ? new Date(
                  new Date(slotStart).getTime() + (service.duration_minutes || 30) * 60_000,
                ).toISOString()
              : "");
          return {
            resource_id: slot.resource_id,
            slot_start: slotStart ?? "",
            slot_end: slotEnd,
          };
        })
        .filter((slot: { slot_start: string }) => isParisDate(slot.slot_start, date));
      }),
    ),
  );

  const slots = Array.from(
    new Map(
      slotResults.flat().map((slot) => [
        `${slot.resource_id}-${slot.slot_start}`,
        { resource_id: slot.resource_id, slot_start: slot.slot_start, slot_end: slot.slot_end },
      ]),
    ).values(),
  ).sort((first, second) =>
    new Date(first.slot_start).getTime() - new Date(second.slot_start).getTime(),
  );

  return {
    date,
    opening: hours ?? null,
    resources: resources.map((resource) => ({ id: resource.id, name: resource.name, capacity: resource.capacity, active: resource.active, color: resource.color || "#D96D4B" })),
    services,
    appointments,
    slots,
  };
}