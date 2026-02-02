/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "tavoleefavole-strapi.onrender.com" },
      { protocol: "https", hostname: "res.cloudinary.com" }, // ✅ serve per le immagini
    ],
  },
};

export default nextConfig;
