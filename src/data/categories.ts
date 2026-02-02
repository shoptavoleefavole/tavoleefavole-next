export type SubCategory = {
  label: string;
  slug: string;
};

export type MacroCategory = {
  label: string;
  slug: string;
  /**
   * Path in /public (es. "/icons/icona-cupcake.webp").
   * Usata nel frontend per mostrare l’icona della macroarea.
   */
  icon: string;
  subcategories: SubCategory[];
};

export const macroCategories: MacroCategory[] = [
  {
    label: "Cake Design",
    slug: "cake-design",
    icon: "/icons/icona-cupcake.webp",
    subcategories: [
      { label: "Stampi", slug: "stampi" },
      { label: "Cake topper", slug: "cake-topper" },
      { label: "Coloranti", slug: "coloranti" },
      { label: "Attrezzi", slug: "attrezzi" },
      { label: "Decorazioni", slug: "decorazioni" },
    ],
  },
  {
    label: "Specialità dolciarie",
    slug: "specialita-dolciarie",
    icon: "/icons/icona-caramelle.webp",
    subcategories: [
      { label: "Dolci & basi", slug: "dolci-basi" },
      { label: "Ingredienti", slug: "ingredienti" },
      { label: "Guarnizioni", slug: "guarnizioni" },
      { label: "Gift box", slug: "gift-box" },
    ],
  },
  {
    label: "Confetti",
    slug: "confetti",
    icon: "/icons/icona-confetti.webp",
    subcategories: [
      { label: "Classici", slug: "classici" },
      { label: "Gourmet", slug: "gourmet" },
      { label: "Senza glutine", slug: "senza-glutine" },
      { label: "Mix & Box", slug: "mix-box" },
    ],
  },
  {
    label: "Bottiglie",
    slug: "bottiglie",
    icon: "/icons/icona-bottiglia.webp",
    subcategories: [
      { label: "Vetro", slug: "vetro" },
      { label: "Plastica", slug: "plastica" },
      { label: "Tappi & accessori", slug: "tappi-accessori" },
    ],
  },
  {
    label: "Idee regalo",
    slug: "idee-regalo",
    icon: "/icons/icona-regalo.webp",
    subcategories: [
      { label: "Sacchetti", slug: "sacchetti" },
      { label: "Scatoline", slug: "scatoline" },
      { label: "Nastri", slug: "nastri" },
      { label: "Biglietti", slug: "biglietti" },
    ],
  },
  {
    label: "Caffè",
    slug: "caffe",
    icon: "/icons/icona-chicchi-caffe.webp",
    subcategories: [
      { label: "Macinato", slug: "macinato" },
      { label: "Capsule", slug: "capsule" },
      { label: "Accessori", slug: "accessori" },
    ],
  },
];
