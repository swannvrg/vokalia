import { requireUser, resolveAuthorizedBusinessId } from "@/lib/supabase";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: callbackId } = await params;

  try {
    const { supabase, user } = await requireUser();
    const body = await request.json();
    const requestedBusinessId = body.businessId ?? null;

    const businessId = await resolveAuthorizedBusinessId(
      supabase,
      user,
      requestedBusinessId,
    );

    // Verify the callback belongs to this business before updating
    const { data: existing, error: fetchError } = await supabase
      .from("callback_requests")
      .select("id, business_id")
      .eq("id", callbackId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing || existing.business_id !== businessId) {
      return Response.json({ error: "Demande introuvable." }, { status: 404 });
    }

    const newStatus = body.status;
    if (newStatus !== "new" && newStatus !== "done") {
      return Response.json({ error: "Statut invalide." }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = { status: newStatus };
    if (newStatus === "done") {
      updatePayload.called_at = new Date().toISOString();
    } else {
      updatePayload.called_at = null;
    }

    const { error: updateError } = await supabase
      .from("callback_requests")
      .update(updatePayload)
      .eq("id", callbackId);

    if (updateError) throw updateError;
    return Response.json({ ok: true });
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
      { error: "Impossible de mettre à jour la demande." },
      { status: 500 },
    );
  }
}
