export function cld(url: string, opts?: { w?: number; q?: string }) {
  if (!url) return url;
  const w = opts?.w ?? 800;
  const q = opts?.q ?? "auto";

  // inserisce trasformazioni subito dopo "/upload/"
  return url.replace(
    "/upload/",
    `/upload/f_auto,q_${q},w_${w}/`
  );
}