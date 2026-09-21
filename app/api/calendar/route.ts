import { getCalendarData } from "@/lib/calendar";
import { getBusinessIdForCurrentUser, requireUser } from "@/lib/supabase";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  try {
    const { supabase, user } = await requireUser();
    const businessId = await getBusinessIdForCurrentUser(supabase, user.id);
    return Response.json(await getCalendarData(supabase, date, businessId));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Non authentifié." }, { status: 401 });
    }
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Impossible de charger le calendrier." }, { status: 500 });
  }
}