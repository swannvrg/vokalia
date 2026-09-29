import { getCalendarData } from "@/lib/calendar";
import { requireUser, resolveAuthorizedBusinessId } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date =
    url.searchParams.get("date") ??
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(
      new Date(),
    );
  const requestedBusinessId = url.searchParams.get("businessId");

  try {
    const { supabase, user } = await requireUser();
    const businessId = await resolveAuthorizedBusinessId(
      supabase,
      user,
      requestedBusinessId,
    );
    return Response.json(await getCalendarData(supabase, date, businessId));
  } catch (error) {
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
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible de charger le calendrier.",
      },
      { status: 500 },
    );
  }
}