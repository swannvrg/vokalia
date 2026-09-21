import { createInvitationToken, requireAdmin } from "@/lib/supabase";
import { sendSalonInvitationEmail } from "@/lib/email";

export async function GET() {
  try {
    const { supabase } = await requireAdmin();
    const [{ data: requests, error: requestsError }, { data: businesses, error: businessesError }] = await Promise.all([
      supabase.from("invitation_requests").select("id, salon_name, contact_name, email, phone, message, status, created_at, business_id").order("created_at", { ascending: false }),
      supabase.from("businesses").select("id, name, status, owner_user_id").order("name"),
    ]);
    if (requestsError) throw requestsError;
    if (businessesError) throw businessesError;
    return Response.json({ requests: requests ?? [], businesses: businesses ?? [] });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return Response.json({ error: "Accès réservé à l'administrateur." }, { status: 403 });
    console.error(error);
    return Response.json({ error: "Impossible de charger les demandes." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { supabase } = await requireAdmin();
    const body = await request.json();
    const requestId = String(body.requestId ?? "");
    const action = String(body.action ?? "");

    const { data: invitation, error: invitationError } = await supabase
      .from("invitation_requests")
      .select("id, salon_name, contact_name, email, status")
      .eq("id", requestId)
      .eq("status", "pending")
      .single();
    if (invitationError || !invitation) return Response.json({ error: "Demande introuvable ou déjà traitée." }, { status: 404 });

    if (action === "reject") {
      const { error } = await supabase.from("invitation_requests").update({ status: "rejected" }).eq("id", invitation.id).eq("status", "pending");
      if (error) throw error;
      return Response.json({ ok: true });
    }
    if (action !== "approve") return Response.json({ error: "Action inconnue." }, { status: 400 });

    const origin = new URL(request.url).origin;
    const normalizedEmail = invitation.email.trim().toLowerCase();

    // -------------------------------------------------------------------------
    // Étape 1 — Vérifier si un app_user existe déjà pour cet email.
    // -------------------------------------------------------------------------
    const { data: existingOwner, error: existingOwnerError } = await supabase
      .from("app_users")
      .select("id, role, business_id, active")
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (existingOwnerError) throw existingOwnerError;
    if (existingOwner?.role === "admin") {
      return Response.json({ error: "Cette adresse possède déjà un compte administrateur." }, { status: 409 });
    }

    // -------------------------------------------------------------------------
    // Étape 2 — Résoudre ou créer le business.
    // La contrainte app_users_role_business_consistency impose que tout owner
    // ait un business_id non-null dès son INSERT. On crée donc le business
    // EN PREMIER, puis l'owner avec son business_id déjà connu.
    //
    // Dépendance circulaire gérée en deux passes :
    //   a. INSERT businesses sans app_user_id (nullable)
    //   b. INSERT app_users avec business_id déjà connu
    //   c. UPDATE businesses SET app_user_id = owner.id
    // -------------------------------------------------------------------------
    let businessId: string;

    if (existingOwner) {
      // L'owner existe déjà — on cherche son business.
      const { data: existingBusiness, error: bizErr } = await supabase
        .from("businesses")
        .select("id, name")
        .eq("app_user_id", existingOwner.id)
        .maybeSingle();
      if (bizErr) throw bizErr;

      if (existingBusiness) {
        if (existingBusiness.name !== invitation.salon_name) {
          return Response.json({ error: "Cette adresse est déjà liée à un autre salon." }, { status: 409 });
        }
        businessId = existingBusiness.id;
      } else {
        // Owner sans business (état incohérent laissé par une erreur passée) —
        // on crée le business et on le lie immédiatement.
        const { data: newBiz, error: newBizErr } = await supabase
          .from("businesses")
          .insert({ name: invitation.salon_name, business_type: "salon", real_phone_number: "", twilio_number: "", app_user_id: existingOwner.id, status: "active" })
          .select("id")
          .single();
        if (newBizErr) throw newBizErr;
        if (!newBiz) throw new Error("BUSINESS_CREATE_FAILED");
        businessId = newBiz.id;

        // Synchroniser business_id sur l'owner si manquant.
        if (!existingOwner.business_id) {
          const { error: updErr } = await supabase.from("app_users").update({ business_id: businessId }).eq("id", existingOwner.id);
          if (updErr) throw updErr;
        }
      }

      // Créer le token d'invitation et terminer.
      const token = await createInvitationToken(existingOwner.id);
      const { error: updateError } = await supabase
        .from("invitation_requests")
        .update({ status: "approved", business_id: businessId })
        .eq("id", invitation.id)
        .eq("status", "pending");
      if (updateError) throw updateError;
      const invitationUrl = `${origin}/invitation?token=${encodeURIComponent(token)}`;
      try {
        await sendSalonInvitationEmail({ to: invitation.email, contactName: invitation.contact_name || invitation.email, salonName: invitation.salon_name, invitationUrl });
      } catch (emailError) {
        console.error("[invitations/approve] Échec envoi email invitation :", emailError instanceof Error ? emailError.message : emailError);
        return Response.json({ ok: true, emailSent: false, invitationUrl, warning: "Le salon est créé, mais l'envoi de l'email d'invitation a échoué. Renvoyez le lien manuellement : " + invitationUrl });
      }
      return Response.json({ ok: true, emailSent: true });
    }

    // -------------------------------------------------------------------------
    // Nouvel owner — créer le business d'abord (sans app_user_id),
    // puis l'owner avec business_id, puis lier les deux.
    // -------------------------------------------------------------------------

    // a. Créer le business (app_user_id null pour l'instant — colonne nullable).
    const { data: newBusiness, error: newBusinessError } = await supabase
      .from("businesses")
      .insert({ name: invitation.salon_name, business_type: "salon", real_phone_number: "", twilio_number: "", status: "active" })
      .select("id, name")
      .single();
    if (newBusinessError) {
      console.error("[invitations/approve] Échec création business :", {
        code: newBusinessError.code,
        message: newBusinessError.message,
        details: newBusinessError.details,
        hint: newBusinessError.hint,
      });
      throw newBusinessError;
    }
    if (!newBusiness) throw new Error("BUSINESS_CREATE_FAILED");
    businessId = newBusiness.id;

    // b. Créer l'owner avec business_id déjà connu — satisfait la contrainte CHECK.
    const { data: newOwner, error: insertOwnerError } = await supabase
      .from("app_users")
      .insert({ email: normalizedEmail, role: "owner", active: true, business_id: businessId })
      .select("id, role, business_id, active")
      .single();

    if (insertOwnerError) {
      console.error("[invitations/approve] Échec création app_user :", {
        code: insertOwnerError.code,
        message: insertOwnerError.message,
        details: insertOwnerError.details,
        hint: insertOwnerError.hint,
      });

      // Conflit unique (23505) : l'owner a été créé entre-temps (race).
      // On nettoie le business orphelin et on relance avec l'owner existant.
      await supabase.from("businesses").delete().eq("id", businessId);
      throw new Error(`OWNER_CREATE_FAILED: ${insertOwnerError.code} — ${insertOwnerError.message}`);
    }
    if (!newOwner) throw new Error("OWNER_CREATE_FAILED: aucune donnée retournée.");

    // c. Mettre à jour le business avec l'app_user_id maintenant connu.
    const { error: linkError } = await supabase.from("businesses").update({ app_user_id: newOwner.id }).eq("id", businessId);
    if (linkError) throw linkError;

    // -------------------------------------------------------------------------
    // Étape 3 — Token d'invitation + mise à jour de la demande + envoi email.
    // -------------------------------------------------------------------------
    const token = await createInvitationToken(newOwner.id);
    const { error: updateError } = await supabase
      .from("invitation_requests")
      .update({ status: "approved", business_id: businessId })
      .eq("id", invitation.id)
      .eq("status", "pending");
    if (updateError) throw updateError;

    const invitationUrl = `${origin}/invitation?token=${encodeURIComponent(token)}`;
    try {
      await sendSalonInvitationEmail({ to: invitation.email, contactName: invitation.contact_name || invitation.email, salonName: invitation.salon_name, invitationUrl });
    } catch (emailError) {
      console.error("[invitations/approve] Échec envoi email invitation :", emailError instanceof Error ? emailError.message : emailError);
      return Response.json({ ok: true, emailSent: false, invitationUrl, warning: "Le salon est créé, mais l'envoi de l'email d'invitation a échoué. Renvoyez le lien manuellement : " + invitationUrl });
    }
    return Response.json({ ok: true, emailSent: true });

  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHENTICATED") return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (error instanceof Error && error.message === "FORBIDDEN") return Response.json({ error: "Accès réservé à l'administrateur." }, { status: 403 });
    console.error("[invitations/approve] Erreur non gérée :", error);
    return Response.json({ error: "Impossible de traiter la demande." }, { status: 500 });
  }
}