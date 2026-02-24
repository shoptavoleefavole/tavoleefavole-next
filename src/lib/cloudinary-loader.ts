import type { ImageLoader } from "next/image";

function isUrl(s: string) {
  return /^https?:\/\//i.test(s);
}

function isAllowedHost(url: URL) {
  return (
    url.hostname === "res.cloudinary.com" ||
    url.hostname === "tavoleefavole-strapi.onrender.com" ||
    (url.hostname === "localhost" && url.port === "1337")
  );
}

/**
 * Risparmio dati:
 * - f_auto: formato migliore (avif/webp quando possibile)
 * - q_auto:eco: qualità leggera
 * - w_<width>: dimensione richiesta da next/image
 * - dpr_auto: densità automatica
 */
export const smartImageLoader: ImageLoader = ({ src, width, quality }) => {
  const q = typeof quality === "number" ? quality : 60;

  // Se è un URL completo:
  if (isUrl(src)) {
    const u = new URL(src);

    // Sicurezza: non permettere host arbitrari
    if (!isAllowedHost(u)) return src;

    // Se è Cloudinary, inseriamo trasformazioni per risparmio dati
    if (u.hostname === "res.cloudinary.com") {
      // Inserisce transformation subito dopo "/upload/"
      // .../image/upload/<TRANSFORMS>/...
      const transforms = `f_auto,q_auto:eco,w_${width},dpr_auto,q_${q}`;
      u.pathname = u.pathname.replace("/upload/", `/upload/${transforms}/`);
      return u.toString();
    }

    // Strapi o localhost: lasciamo così (Next farà responsive via srcset se possibile)
    return u.toString();
  }

  // Se invece passi un publicId Cloudinary (consigliato)
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) {
    throw new Error("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is missing");
  }

  const safeSrc = src.replace(/^\/+/, "");
  const transforms = `f_auto,q_auto:eco,w_${width},dpr_auto,q_${q}`;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${encodeURI(
    safeSrc
  )}`;
};