const WHATSAPP_NUMBER = "393482783901";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Ciao Tavole & Favole! Ho bisogno di informazioni 🙂"
)}`;

export default function WhatsAppFloatingButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Apri WhatsApp"
      className="fixed bottom-5 left-5 z-[9999] grid h-14 w-14 place-items-center rounded-full border border-border bg-background shadow-lg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary text-[#25D366]"
    >
      {/* WhatsApp icon (inline svg) */}
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
        <path
          d="M19.11 17.53c-.28-.14-1.65-.81-1.9-.9-.26-.1-.44-.14-.62.14-.19.28-.72.9-.88 1.08-.16.19-.32.21-.6.07-.28-.14-1.16-.43-2.22-1.37-.82-.73-1.37-1.63-1.53-1.9-.16-.28-.02-.43.12-.57.12-.12.28-.32.42-.49.14-.16.19-.28.28-.46.09-.19.05-.35-.02-.49-.07-.14-.62-1.49-.85-2.05-.22-.53-.45-.46-.62-.47l-.53-.01c-.19 0-.49.07-.75.35-.26.28-.98.96-.98 2.34 0 1.38 1 2.71 1.14 2.9.14.19 1.96 3 4.76 4.2.67.29 1.19.46 1.6.58.67.21 1.28.18 1.76.11.54-.08 1.65-.67 1.88-1.31.23-.64.23-1.19.16-1.31-.07-.12-.25-.19-.53-.33z"
          fill="currentColor"
        />
        <path
          d="M16.02 3.2c-6.98 0-12.64 5.66-12.64 12.64 0 2.22.58 4.31 1.6 6.13L3.2 28.8l7-1.84c1.75.96 3.76 1.51 5.92 1.51 6.98 0 12.64-5.66 12.64-12.64S23 3.2 16.02 3.2zm0 22.92c-2.02 0-3.87-.6-5.42-1.64l-.39-.24-4.15 1.09 1.11-4.04-.26-.42a10.48 10.48 0 0 1-1.64-5.59c0-5.77 4.68-10.45 10.45-10.45 5.77 0 10.45 4.68 10.45 10.45 0 5.77-4.68 10.45-10.45 10.45z"
          fill="currentColor"
        />
      </svg>
    </a>
  );
}
