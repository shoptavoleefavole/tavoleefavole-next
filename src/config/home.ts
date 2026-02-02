export type BreakpointCols = {
  base: number;
  sm?: number;
  md?: number;
  lg?: number;
};

export type HomeCta = {
  label: string;
  href: string;
};

export type HomeSectionBase = {
  id: string;
  order: number;
  isEnabled?: boolean;
  /** Extra Tailwind classes for padding/background etc. */
  className?: string;
};

export type HeroSection = HomeSectionBase & {
  type: "hero";
  badge?: string;
  title: string;
  subtitle?: string;
  primaryCta?: HomeCta;
  secondaryCta?: HomeCta;
  /** Optional side images to mimic the reference layout */
  leftImage?: { src: string; alt: string };
  rightImage?: { src: string; alt: string };
  highlights?: Array<{ title: string; body: string }>; // small cards under hero copy
};

export type FeaturedProductsSection = HomeSectionBase & {
  type: "featuredProducts";
  title: string;
  subtitle?: string;
  viewAll?: HomeCta;
  limit?: number;
};

export type CardGridSection = HomeSectionBase & {
  type: "cardGrid";
  title: string;
  subtitle?: string;
  cols: BreakpointCols;
  cards: Array<{
    id: string;
    title: string;
    subtitle?: string;
    href: string;
    image?: { src: string; alt: string };
    isEnabled?: boolean;
  }>;
  /** If true, the card shows subtitle; if false, only title overlay. */
  showSubtitle?: boolean;
};

export type TrustSection = HomeSectionBase & {
  type: "trust";
  title: string;
  items: Array<{ title: string; body: string; icon?: "truck" | "badge" | "support" | "lock" }>;
  cols?: BreakpointCols;
};

export type TestimonialsSection = HomeSectionBase & {
  type: "testimonials";
  title: string;
  items: Array<{ name: string; body: string; rating: number }>; // rating 1..5
};

export type NewsletterSection = HomeSectionBase & {
  type: "newsletter";
  title: string;
  subtitle?: string;
  placeholder?: string;
  ctaLabel?: string;
};

export type HomeSection =
  | HeroSection
  | FeaturedProductsSection
  | CardGridSection
  | TrustSection
  | TestimonialsSection
  | NewsletterSection;

export type HomeConfig = {
  theme?: {
    /** HSL string, e.g. "329 74% 47%". Only used in some gradient areas. */
    brandHsl?: string;
  };
  sections: HomeSection[];
};

export const homeConfigDefault: HomeConfig = {
  theme: { brandHsl: "329 74% 47%" },
  sections: [
    {
      id: "hero",
      type: "hero",
      order: 10,
      className: "bg-secondary",
      // Badge piccolo sopra il titolo (evitiamo il default "In evidenza: ...")
      badge: "Novità",
      // TESTO CENTRALE richiesto
      title: "Crea magia in cucina!",
      subtitle: "Scopri le novità",
      primaryCta: { label: "Acquista ora", href: "/catalogo" },
      secondaryCta: { label: "Idee regalo", href: "/categoria/idee-regalo" },

      // Immagini laterali: per ora usiamo asset locali già presenti (zero 404).
      // Nel prossimo step “Asset” le sostituiamo con immagini definitive torte/bottiglie/caffè.
      leftImage: { src: "/icons/icona-cupcake.webp", alt: "Torte e cake design" },
      rightImage: { src: "/icons/icona-chicchi-caffe.webp", alt: "Caffè e bevande" },

      highlights: [
        { title: "Spedizione", body: "Gratuita sopra 79€" },
        { title: "Qualità", body: "Selezione premium" },
        { title: "Supporto", body: "Assistenza H24" },
      ],
    },
    {
      id: "featured",
      type: "featuredProducts",
      order: 20,
      title: "Prodotti in evidenza",
      subtitle: "Una selezione dei nostri preferiti (mock).",
      viewAll: { label: "Vedi tutti", href: "/catalogo" },
      limit: 8,
    },
    {
      id: "categories",
      type: "cardGrid",
      order: 30,
      className: "bg-secondary py-12",
      title: "Le nostre categorie",
      subtitle: "Scegli dove iniziare: ogni card è configurabile e responsive.",
      cols: { base: 2, sm: 3, md: 4, lg: 5 },
      showSubtitle: false,
      cards: [
        {
          id: "cake",
          title: "Cake design",
          href: "/categoria/cake-design",
          image: { src: "https://picsum.photos/seed/cat-cake/1200/800", alt: "Cake design" },
        },
        {
          id: "specialita",
          title: "Specialità dolciarie",
          href: "/categoria/specialita-dolciarie",
          image: { src: "https://picsum.photos/seed/cat-dolci/1200/800", alt: "Specialità dolciarie" },
        },
        {
          id: "bottiglie",
          title: "Bottiglie",
          href: "/categoria/bottiglie",
          image: { src: "https://picsum.photos/seed/cat-bottiglie/1200/800", alt: "Bottiglie" },
        },
        {
          id: "caffe",
          title: "Caffè",
          href: "/categoria/caffe",
          image: { src: "https://picsum.photos/seed/cat-caffe/1200/800", alt: "Caffè" },
        },
        {
          id: "regalo",
          title: "Idee regalo",
          href: "/categoria/idee-regalo",
          image: { src: "https://picsum.photos/seed/cat-regalo/1200/800", alt: "Idee regalo" },
        },
      ],
    },
    {
      id: "trust",
      type: "trust",
      order: 40,
      title: "Perché sceglierci",
      cols: { base: 1, sm: 3 },
      items: [
        { title: "Spedizione gratuita", body: "Sopra 79€ (mock)", icon: "truck" },
        { title: "Qualità garantita", body: "Prodotti selezionati (mock)", icon: "badge" },
        { title: "Supporto H24", body: "Assistenza rapida (mock)", icon: "support" },
      ],
    },
    {
      id: "testimonials",
      type: "testimonials",
      order: 50,
      className: "bg-secondary py-12",
      title: "Dicono di noi",
      items: [
        { name: "Beatrice", body: "Sito chiaro e prodotti arrivati in perfette condizioni.", rating: 5 },
        { name: "Samanta", body: "Ottima selezione, trovato subito quello che cercavo.", rating: 5 },
        { name: "Alma", body: "Checkout semplice e assistenza rapida.", rating: 4 },
      ],
    },
    {
      id: "newsletter",
      type: "newsletter",
      order: 60,
      title: "Iscriviti alla Newsletter per offerte esclusive",
      subtitle: "Novità e promozioni, max 1 email a settimana (mock).",
      placeholder: "Email",
      ctaLabel: "Iscriviti",
    },
  ],
};

export const homeConfigPromo: HomeConfig = {
  theme: { brandHsl: "20 92% 50%" },
  sections: [
    {
      ...(homeConfigDefault.sections.find((s) => s.id === "hero")!),
      id: "hero",
      order: 10,
      badge: "Promo del mese",
      title: "Risparmia con le promo",
      subtitle: "Layout identico, contenuti diversi: cambia da config.",
    } as HeroSection,
    { ...(homeConfigDefault.sections.find((s) => s.id === "newsletter")!), id: "newsletter", order: 20 } as NewsletterSection,
    { ...(homeConfigDefault.sections.find((s) => s.id === "featured")!), id: "featured", order: 30, title: "Top deals" } as FeaturedProductsSection,
    {
      id: "quick",
      type: "cardGrid",
      order: 40,
      title: "Percorsi rapidi (titoli molto lunghi per test)",
      subtitle: "Questa sezione stressa wrapping e clamp.",
      cols: { base: 1, sm: 2, md: 3, lg: 4 },
      showSubtitle: true,
      cards: [
        {
          id: "l1",
          title: "Decorazioni super-extra-lunghe per torte scenografiche e cake topper personalizzati",
          subtitle: "Test clamp 2-3 righe",
          href: "/categoria/cake-design",
          image: { src: "https://picsum.photos/seed/quick1/1200/800", alt: "Quick 1" },
        },
        {
          id: "l2",
          title: "Confezioni regalo pronte per cerimonie, anniversari e ricorrenze",
          subtitle: "Test parole lunghe",
          href: "/categoria/idee-regalo",
          image: { src: "https://picsum.photos/seed/quick2/1200/800", alt: "Quick 2" },
        },
      ],
    },
  ],
};
