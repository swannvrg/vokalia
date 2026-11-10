// Règles de mot de passe communes à tous les points d'entrée
// (invitation, premier changement, changement depuis le profil).
export const PASSWORD_POLICY_MESSAGE =
  "Le mot de passe doit contenir 8 caractères, une majuscule, un chiffre et un symbole.";

const MAX_PASSWORD_LENGTH = 128;

export function isStrongPassword(value: string) {
  return (
    value.length >= 8 &&
    value.length <= MAX_PASSWORD_LENGTH &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}
