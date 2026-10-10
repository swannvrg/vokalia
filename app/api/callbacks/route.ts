import { requireUser, resolveAuthorizedBusinessId } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedBusinessId = url.searchParams.get("businessId");

  try {
    const { supabase, user } = await requireUser();
    const businessId = await resolveAuthorizedBusinessId(
      supabase,
      user,
      requestedBusinessId,
    );

    const { data, error } = await supabase
      .from("callback_requests")
      .select("id, customer_name, callback_number, reason, status, created_at, called_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return Response.json(data ?? []);
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
      { error: "Impossible de charger les demandes de rappel." },
      { status: 500 },
    );
  }
}
