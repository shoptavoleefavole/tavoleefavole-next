// next.config.mjs
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  reactStrictMode: true,

  images: {
    // ✅ Permette a next/image di caricare immagini esterne (Strapi / eventuale CDN)
    remotePatterns: [
      // Strapi su Render
      {
        protocol: "https",
        hostname: "tavoleefavole-strapi.onrender.com",
        pathname: "/**",
      },

      // Se alcune immagini arrivano già così (non implica abbonamenti)
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },

      // Strapi in locale (se lo riusi in futuro)
      {
        protocol: "http",
        hostname: "localhost",
        port: "1337",
        pathname: "/**",
      },
    ],
  },

  // ✅ evita warning root errato in workspace con più lockfile
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
