export function formatPhoneDisplay(e164?: string | null): string {
  if (!e164) return "";
  const fr = e164.match(/^\+33(\d{9})$/);
  if (fr) {
    const digits = `0${fr[1]}`;
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ");
  }
  return e164;
}
