import { requireAdmin } from "@/lib/supabase";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireAdmin();
    const { id } = await context.params;
    const { data: business, error: lookupError } = await supabase.from("businesses").select("id").eq("id", id).maybeSingle();
    if (lookupError) throw lookupError;
    if (!business) return Response.json({ error: "Salon introuvable ou déjà supprimé." }, { status: 404 });
    const { error } = await supabase.from("businesses").delete().eq("id", id);
    if (error) throw error;
    return Response.json({ ok: true, deletedBusinessId: id });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return Response.json({ error: "Accès réservé à l'administrateur." }, { status: 403 });
    console.error(error);
    return Response.json({ error: "Impossible de supprimer le salon. Vérifiez les contraintes de cascade en base." }, { status: 500 });
  }
}