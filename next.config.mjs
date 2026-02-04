/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // ✅ evita 504 "upstream image response timed out" quando Strapi/Render è lento
    unoptimized: true,

    // (puoi lasciarlo comunque: utile per validazioni e future modifiche)
    remotePatterns: [
      { protocol: "https", hostname: "tavoleefavole-strapi.onrender.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
