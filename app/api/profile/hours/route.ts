import { requireUser, resolveAuthorizedBusinessId } from "@/lib/supabase";

function handleApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message === "UNAUTHENTICATED") {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return Response.json({ error: "Accès refusé à ce salon." }, { status: 403 });
  }
  if (
    error instanceof Error &&
    (error.message === "SALON_NOT_FOUND" || error.message === "NO_BUSINESS")
  ) {
    return Response.json({ error: "Salon introuvable." }, { status: 404 });
  }
  console.error(error);
  return Response.json({ error: fallbackMessage }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const url = new URL(request.url);
    const businessId = await resolveAuthorizedBusinessId(
      supabase,
      user,
      url.searchParams.get("businessId"),
    );
    const { data, error } = await supabase
      .from("business_hours")
      .select("id, day_of_week, open_time, close_time")
      .eq("business_id", businessId)
      .order("day_of_week");
    if (error) throw error;
    const rows = data ?? [];
    const zeroBased = rows.some((row) => Number(row.day_of_week) === 0);
    return Response.json(
      rows.map((row) => ({
        ...row,
        day_of_week: zeroBased ? Number(row.day_of_week) + 1 : Number(row.day_of_week),
      })),
    );
  } catch (error) {
    return handleApiError(error, "Impossible de charger les horaires.");
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const businessId = await resolveAuthorizedBusinessId(
      supabase,
      user,
      body.businessId,
    );
    const { data: existing, error: existingError } = await supabase
      .from("business_hours")
      .select("id, day_of_week")
      .eq("business_id", businessId);
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
    return handleApiError(error, "Impossible d'enregistrer les horaires.");
  }
}
