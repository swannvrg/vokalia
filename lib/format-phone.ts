export function formatPhoneDisplay(e164?: string | null): string {
  if (!e164) return "";
  const fr = e164.match(/^\+33(\d{9})$/);
  if (fr) {
    const digits = `0${fr[1]}`;
    return digits.replace(/(\d{2})(?=\d)/g, "$1 ");
  }
  if (/^0\d{9}$/.test(e164)) {
    return e164.replace(/(\d{2})(?=\d)/g, "$1 ");
  }
  return e164;
}

export function normalizeFrenchPhone(value: string): string | null {
  const compact = value.replace(/[\s().-]/g, "");
  if (/^0[1-9]\d{8}$/.test(compact)) return `+33${compact.slice(1)}`;
  if (/^\+33[1-9]\d{8}$/.test(compact)) return compact;
  return null;
}
