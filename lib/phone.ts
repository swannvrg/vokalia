export function normalizeAssistantPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[\s().-]/g, "");
  const frenchNumber = compact.match(/^(?:0|(?:\+33))([1-9]\d{8})$/);
  if (!frenchNumber) {
    throw new Error("INVALID_ASSISTANT_PHONE");
  }

  return `+33${frenchNumber[1]}`;
}
