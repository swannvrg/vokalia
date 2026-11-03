import nodemailer from "nodemailer";

// ---------------------------------------------------------------------------
// Transporter SMTP — toute la config vient des variables d'environnement.
// Aucune valeur en dur. STARTTLS sur le port 587 (secure: false).
// ---------------------------------------------------------------------------
function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const user = process.env.SMTP_USER;
  const pass = process.env.PASSWORD_MAIL_VOKALIA;

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP_CONFIG_MISSING: vérifiez SMTP_HOST, SMTP_PORT, SMTP_USER et PASSWORD_MAIL_VOKALIA dans .env.local");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: false, // STARTTLS — le serveur Infomaniak sur le port 587 upgradera la connexion
    auth: { user, pass },
  });
}

// ---------------------------------------------------------------------------
// Échappement HTML minimal (inchangé par rapport à l'ancienne version)
// ---------------------------------------------------------------------------
function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

// ---------------------------------------------------------------------------
// Envoi générique — destinataire, sujet, corps HTML (+ fallback texte brut)
// ---------------------------------------------------------------------------
export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html: string; text?: string }) {
  const transporter = createTransporter();
  const from = `Vokalia <${process.env.SMTP_USER}>`;

  try {
    await transporter.sendMail({ from, to, subject, html, text: text ?? html.replace(/<[^>]+>/g, " ") });
  } catch (error) {
    // On logue sans ré-exposer de donnée sensible (le mot de passe est dans l'env, pas dans le message)
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`SMTP_SEND_ERROR: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Invitation salon — même contenu qu'avant, via le nouvel expéditeur
// ---------------------------------------------------------------------------
export async function sendSalonInvitationEmail({
  to,
  contactName,
  salonName,
  invitationUrl,
}: {
  to: string;
  contactName: string;
  salonName: string;
  invitationUrl: string;
}) {
  const safeContactName = escapeHtml(contactName);
  const safeSalonName = escapeHtml(salonName);
  const safeInvitationUrl = escapeHtml(invitationUrl);

  const html = `
<p>Bonjour ${safeContactName},</p>
<p>Votre espace pour <strong>${safeSalonName}</strong> vient d'être créé sur Vokalia.</p>
<p>
  <a href="${safeInvitationUrl}" style="display:inline-block;padding:10px 20px;background:#BD5B39;color:#F2ECE1;text-decoration:none;border-radius:10px;font-weight:600;">
    Définir mon mot de passe et accéder à mon espace
  </a>
</p>
<p>Ce lien vous permettra de terminer votre inscription. Il est à usage unique.</p>
<p style="color:#8C8172;font-size:0.9em;">Si vous n'avez pas demandé à rejoindre Vokalia, vous pouvez ignorer cet email.</p>
`.trim();

  await sendEmail({ to, subject: "Votre espace Vokalia est prêt", html });
}

export async function sendTemporaryPasswordEmail({
  to,
  firstName,
  salonName,
  loginEmail,
  temporaryPassword,
}: {
  to: string;
  firstName?: string;
  salonName: string;
  loginEmail: string;
  temporaryPassword: string;
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (!siteUrl) throw new Error("SITE_URL_MISSING");

  const safeSalonName = escapeHtml(salonName);
  const safeLoginEmail = escapeHtml(loginEmail);
  const safeTemporaryPassword = escapeHtml(temporaryPassword);
  const safeFirstName = firstName?.trim() ? escapeHtml(firstName.trim()) : "";
  const loginUrl = `${siteUrl}/login`;
  const safeLoginUrl = escapeHtml(loginUrl);
  const greeting = safeFirstName ? `Bonjour ${safeFirstName},` : "Bonjour,";
  const html = `
<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:0;background:#F2ECE1;color:#3B302A;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F2ECE1;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;">
            <tr>
              <td style="padding:24px;">
                <div style="font-size:28px;line-height:1;font-weight:700;letter-spacing:-.04em;color:#BD5B39;">Vokalia</div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px;">
                <p style="margin:0 0 16px;">${greeting}</p>
                <p style="margin:0 0 24px;">Votre espace pour <strong>${safeSalonName}</strong> vient d'être créé sur Vokalia.</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8F5F0;border:1px solid #E5DCD2;">
                  <tr>
                    <td style="padding:16px 18px;">
                      <p style="margin:0 0 10px;font-weight:700;color:#3B302A;">Vos accès</p>
                      <p style="margin:0 0 6px;">Email de connexion : <span style="font-family:Consolas,'Courier New',monospace;overflow-wrap:anywhere;">${safeLoginEmail}</span></p>
                      <p style="margin:0;">Mot de passe provisoire : <span style="font-family:Consolas,'Courier New',monospace;overflow-wrap:anywhere;">${safeTemporaryPassword}</span></p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto 8px;">
                  <tr>
                    <td align="center" bgcolor="#BD5B39" style="border-radius:10px;">
                      <a href="${safeLoginUrl}" style="display:inline-block;min-height:44px;box-sizing:border-box;padding:11px 22px;color:#FFFFFF;text-decoration:none;font-weight:700;line-height:22px;">Accéder à mon espace</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 24px;text-align:center;font-size:13px;overflow-wrap:anywhere;">
                  <a href="${safeLoginUrl}" style="color:#8C4B35;">${safeLoginUrl}</a>
                </p>
                <p style="margin:0 0 10px;font-weight:700;">Comment ça se passe</p>
                <ol style="margin:0 0 24px;padding-left:22px;">
                  <li style="margin-bottom:6px;">Connectez-vous avec les accès ci-dessus.</li>
                  <li style="margin-bottom:6px;">Choisissez votre propre mot de passe (obligatoire dès la première connexion).</li>
                  <li>Configurez votre salon en 4 étapes : infos, horaires, coiffeurs, prestations (environ 5 minutes).</li>
                </ol>
                <p style="margin:0 0 20px;padding:14px 16px;background:#FFF7ED;border-left:3px solid #C89B57;">Ce mot de passe est provisoire : vous devrez le remplacer dès votre première connexion. Ne le partagez avec personne.</p>
                <p style="margin:0;">Une question ? Écrivez à <a href="mailto:contact@vokalia.fr" style="color:#8C4B35;">contact@vokalia.fr</a>.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px;background:#F8F5F0;color:#6F6259;font-size:13px;">
                <p style="margin:0 0 8px;">Vokalia, l'agent vocal qui aide les salons à ne plus rater un appel.</p>
                <p style="margin:0;">Si vous n'avez pas demandé à rejoindre Vokalia, vous pouvez ignorer cet email.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
  const text = [
    greeting,
    "",
    `Votre espace pour ${salonName} vient d'être créé sur Vokalia.`,
    "",
    "VOS ACCÈS",
    `Email de connexion : ${loginEmail}`,
    `Mot de passe provisoire : ${temporaryPassword}`,
    "",
    "Accéder à mon espace :",
    loginUrl,
    "",
    "COMMENT ÇA SE PASSE",
    "1. Connectez-vous avec les accès ci-dessus.",
    "2. Choisissez votre propre mot de passe (obligatoire dès la première connexion).",
    "3. Configurez votre salon en 4 étapes : infos, horaires, coiffeurs, prestations (environ 5 minutes).",
    "",
    "Ce mot de passe est provisoire : vous devrez le remplacer dès votre première connexion. Ne le partagez avec personne.",
    "",
    "Une question ? Écrivez à contact@vokalia.fr.",
    "",
    "Vokalia, l'agent vocal qui aide les salons à ne plus rater un appel.",
    "Si vous n'avez pas demandé à rejoindre Vokalia, vous pouvez ignorer cet email.",
  ].join("\n");

  await sendEmail({
    to,
    subject: "Votre espace Vokalia est prêt",
    html,
    text,
  });
}
