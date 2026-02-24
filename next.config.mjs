// next.config.mjs
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    // Risparmio dati: formati moderni quando possibile
    formats: ["image/avif", "image/webp"],

    // Necessario per evitare warning ora e requisito in Next 16 se usi quality custom
    qualities: [60, 75],

    remotePatterns: [
      // Strapi su Render
      {
        protocol: "https",
        hostname: "tavoleefavole-strapi.onrender.com",
        pathname: "/**",
      },

      // Cloudinary (meglio restringere al tuo cloud se disponibile)
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: cloudName ? `/${cloudName}/**` : "/**",
      },

      // Strapi locale (dev)
      {
        protocol: "http",
        hostname: "localhost",
        port: "1337",
        pathname: "/**",
      },
    ],
  },

  // evita warning root errato in workspace con più lockfile
  outputFileTracingRoot: __dirname,
};

export default nextConfig;