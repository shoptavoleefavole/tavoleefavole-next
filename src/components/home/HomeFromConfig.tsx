import Container from "@/components/Container";
import ResponsiveGrid from "@/components/ResponsiveGrid";
import SectionHero from "@/components/sections/SectionHero";
import SectionFeaturedProducts from "@/components/sections/SectionFeaturedProducts";
import SectionTrust from "@/components/sections/SectionTrust";
import SectionNewsletter from "@/components/sections/SectionNewsletter";
import type { HomeConfig, HomeSection, CardGridSection } from "@/config/home";
import Image from "next/image";
import Link from "next/link";

// ✅ Standard "Deghi-like"
const SECTION_Y = "py-10 md:py-14 lg:py-16";
const TITLE_CLS = "text-2xl font-extrabold text-text smart-wrap md:text-3xl md:tracking-tight";
const SUBTITLE_CLS = "mt-2 text-sm text-muted-text smart-wrap md:text-base";

function CardGrid({ section }: { section: CardGridSection }) {
  const cls = section.className ?? SECTION_Y;

  return (
    <section aria-label={section.title} className={cls}>
      <Container>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h2 className={TITLE_CLS}>{section.title}</h2>
            {section.subtitle ? <p className={SUBTITLE_CLS}>{section.subtitle}</p> : null}
          </div>
        </div>

        <ResponsiveGrid cols={section.cols} className="mt-6 md:mt-8">
          {section.cards
            .filter((c) => c.isEnabled !== false)
            .map((c) => (
              <Link
                key={c.id}
                href={c.href}
                className="group relative overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="relative aspect-[4/3] bg-surface">
                  {c.image ? (
                    <Image
                      src={c.image.src}
                      alt={c.image.alt}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                    />
                  ) : null}

                  {/* Overlay per contrasto testo su foto */}
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
                    aria-hidden="true"
                  />
                </div>

                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="text-sm font-semibold text-text-on-dark smart-wrap line-clamp-2">
                    {c.title}
                  </div>
                  {section.showSubtitle && c.subtitle ? (
                    <div className="mt-1 text-xs text-white/90 smart-wrap line-clamp-2">
                      {c.subtitle}
                    </div>
                  ) : null}
                </div>
              </Link>
            ))}
        </ResponsiveGrid>
      </Container>
    </section>
  );
}

function Testimonials({
  title,
  items,
  className,
}: Extract<HomeSection, { type: "testimonials" }>) {
  const cls = className ?? SECTION_Y;

  return (
    <section aria-label={title} className={cls}>
      <Container>
        <div className="max-w-2xl">
          <h2 className={TITLE_CLS}>{title}</h2>
        </div>

        <div className="mt-6 flex gap-4 overflow-x-auto pb-2 no-scrollbar [scroll-snap-type:x_mandatory] md:mt-8">
          {items.map((t, idx) => (
            <article
              key={`${t.name}-${idx}`}
              className="w-[280px] flex-none scroll-ml-4 [scroll-snap-align:start] rounded-2xl border border-border bg-background p-5 shadow-sm"
            >
              <div className="text-sm text-warn" aria-label={`Valutazione ${t.rating} su 5`}>
                {"★".repeat(Math.max(1, Math.min(5, t.rating)))}
              </div>
              <p className="mt-2 text-sm text-text smart-wrap">{t.body}</p>
              <div className="mt-3 text-xs font-semibold text-muted-text">{t.name}</div>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Divider() {
  return (
    <div className="border-t border-border" aria-hidden="true">
      <Container>
        <div className="h-0" />
      </Container>
    </div>
  );
}

export default function HomeFromConfig({ config }: { config: HomeConfig }) {
  const sections = [...config.sections]
    .filter((s) => s.isEnabled !== false)
    .sort((a, b) => a.order - b.order);

  // ✅ assegna un indice "a strisce" solo alle sezioni NON hero
  let nonHeroIdx = 0;
  const enriched = sections.map((s) => {
    const idx = s.type === "hero" ? -1 : nonHeroIdx++;
    return { s, nonHeroIdx: idx };
  });

  function bgFor(item: { s: HomeSection; nonHeroIdx: number }) {
    if (item.s.type === "hero") return "bg-background";
    // alternanza pulita: bianco / surface
    return item.nonHeroIdx % 2 === 0 ? "bg-background" : "bg-surface/40";
  }

  return (
    <main className="bg-background">
      {enriched.map((item, idx) => {
        const s = item.s;

        const currBg = bgFor(item);
        const prev = idx > 0 ? enriched[idx - 1] : null;
        const prevBg = prev ? bgFor(prev) : null;

        // Divider solo se due sezioni consecutive hanno lo stesso bg (meno “righe” inutili)
        const withDivider = idx > 0 && prevBg === currBg;

        switch (s.type) {
          case "hero":
            return (
              <div key={s.id}>
                <SectionHero
                  className={s.className}
                  badge={s.badge}
                  title={s.title}
                  subtitle={s.subtitle}
                  primaryCta={s.primaryCta}
                  secondaryCta={s.secondaryCta}
                  leftImage={s.leftImage}
                  rightImage={s.rightImage}
                  highlights={s.highlights}
                />
              </div>
            );

          case "featuredProducts":
            return (
              <div key={s.id} className={currBg}>
                {withDivider ? <Divider /> : null}
                <SectionFeaturedProducts title={s.title} subtitle={s.subtitle} viewAll={s.viewAll} limit={s.limit} />
              </div>
            );

          case "cardGrid":
            return (
              <div key={s.id} className={currBg}>
                {withDivider ? <Divider /> : null}
                <CardGrid section={s} />
              </div>
            );

          case "trust":
            return (
              <div key={s.id} className={currBg}>
                {withDivider ? <Divider /> : null}
                <SectionTrust title={s.title} items={s.items} cols={s.cols} className={s.className ?? SECTION_Y} />
              </div>
            );

          case "testimonials":
            return (
              <div key={s.id} className={currBg}>
                {withDivider ? <Divider /> : null}
                <Testimonials {...s} />
              </div>
            );

          case "newsletter":
            return (
              <div key={s.id} className={currBg}>
                {withDivider ? <Divider /> : null}
                <SectionNewsletter title={s.title} subtitle={s.subtitle} placeholder={s.placeholder} ctaLabel={s.ctaLabel} />
              </div>
            );

          default:
            return null;
        }
      })}
    </main>
  );
}
