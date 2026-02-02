export function productKey(p: any): string {
  return String(p?.documentId ?? p?.id ?? "");
}
