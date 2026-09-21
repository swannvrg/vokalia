import type { createSupabaseAdminClient } from "@/lib/supabase";

const parisDateTime = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parisParts(value: Date) {
  const parts = Object.fromEntries(parisDateTime.formatToParts(value).map((part) => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return { date, minutes, weekday };
}

export async function isWithinOpeningHours(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  businessId: string,
  start: Date,
  durationMinutes: number,
) {
  const startParts = parisParts(start);
  const endParts = parisParts(new Date(start.getTime() + durationMinutes * 60_000));
  if (startParts.date !== endParts.date) return false;

  const { data, error } = await supabase
    .from("business_hours")
    .select("day_of_week, open_time, close_time")
    .eq("business_id", businessId);
  if (error) throw error;

  const rows = data ?? [];
  const zeroBased = rows.some((row) => Number(row.day_of_week) === 0);
  const targetDay = zeroBased ? startParts.weekday : startParts.weekday + 1;
  const hours = rows.find((row) => Number(row.day_of_week) === targetDay);
  if (!hours) return false;

  const toMinutes = (value: string) => {
    const [hour, minute] = value.slice(0, 5).split(":").map(Number);
    return hour * 60 + minute;
  };
  return startParts.minutes >= toMinutes(hours.open_time) && endParts.minutes <= toMinutes(hours.close_time);
}
