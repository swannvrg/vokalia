import { getBusinessIdForCurrentUser, requireUser } from "@/lib/supabase";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    const { data, error } = await supabase.from("business_hours").select("id, day_of_week, open_time, close_time").eq("business_id", businessId).order("day_of_week");
    if (error) throw error;
    const rows = data ?? [];
    const zeroBased = rows.some((row) => Number(row.day_of_week) === 0);
    return Response.json(rows.map((row) => ({ ...row, day_of_week: zeroBased ? Number(row.day_of_week) + 1 : Number(row.day_of_week) })));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json({ error: "Impossible de charger les horaires." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    const { data: existing, error: existingError } = await supabase.from("business_hours").select("id, day_of_week").eq("business_id", businessId);
    if (existingError) throw existingError;
    const usesZeroBased = (existing ?? []).some((row) => Number(row.day_of_week) === 0);
    const days = Array.isArray(body.days) ? body.days : [];
    for (const day of days) {
      const dbDay = usesZeroBased ? Number(day.dayOfWeek) - 1 : Number(day.dayOfWeek);
      const current = (existing ?? []).find((row) => Number(row.day_of_week) === dbDay);
      if (day.closed) {
        if (current) {
          const { error } = await supabase.from("business_hours").delete().eq("id", current.id);
          if (error) throw error;
        }
        continue;
      }
      if (current) {
        const { error } = await supabase.from("business_hours").update({ open_time: day.openTime, close_time: day.closeTime }).eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("business_hours").insert({ business_id: businessId, day_of_week: dbDay, open_time: day.openTime, close_time: day.closeTime });
        if (error) throw error;
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    console.error(error);
    return Response.json({ error: "Impossible d'enregistrer les horaires." }, { status: 500 });
  }
}
