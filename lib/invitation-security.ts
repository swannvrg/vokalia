const disposableEmailDomains = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "mailinator.com",
  "probox.my.id",
  "temp-mail.org",
]);

const domainPattern = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/i;
const linkPattern = /https?:\/\/|www\./i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isDisposableEmail(email: string) {
  return disposableEmailDomains.has(email.split("@")[1]?.toLowerCase() ?? "");
}

export function containsLinkOrDomain(message: string) {
  return linkPattern.test(message) || domainPattern.test(message);
}

export function isValidInvitationEmail(email: string) {
  return emailPattern.test(email);
}

export function escapeInvitationHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export function escapeInvitationNonLinkHtml(value: string) {
  const separatedDigits = value.replace(/(\d)(?=\d)/g, "$1\u0000");
  return escapeInvitationHtml(separatedDigits)
    .replace(/([@.:+])/g, "$1&#8203;")
    .replace(/\u0000/g, "&#8203;");
}

export function isInvitationRateLimited(counts: {
  ip: number;
  email: number;
  phone: number;
}) {
  return counts.ip >= 3 || counts.email >= 1 || counts.phone >= 1;
}

export const invitationValidation = {
  maxSalonNameLength: 80,
  maxEmailLength: 120,
  maxMessageLength: 500,
  minPhoneDigits: 9,
  maxPhoneDigits: 15,
};
