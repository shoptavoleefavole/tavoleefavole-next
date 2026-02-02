import Container from "@/components/Container";
import ResponsiveGrid from "@/components/ResponsiveGrid";
import type { BreakpointCols, TrustSection } from "@/config/home";

function Icon({ name }: { name?: TrustSection["items"][number]["icon"] }) {
  const cls = "h-5 w-5 text-primary";
  switch (name) {
    case "truck":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 6h11v10H3V6Z" stroke="currentColor" strokeWidth="2" />
          <path d="M14 10h4l3 3v3h-7v-6Z" stroke="currentColor" strokeWidth="2" />
          <path d="M7 18a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm12 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" fill="currentColor" />
        </svg>
      );
    case "badge":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2l3 3 4 .5-2 3 1 4-3-1-3 2-3-2-3 1 1-4-2-3 4-.5 3-3Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "support":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 12a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="2" />
          <path d="M4 12v4a2 2 0 0 0 2 2h2v-6H4Zm16 0v4a2 2 0 0 1-2 2h-2v-6h4Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "lock":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 11V8a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="2" />
          <path d="M6 11h12v10H6V11Z" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    default:
      return <span className="h-5 w-5" aria-hidden="true" />;
  }
}

type Props = {
  title?: string;
  items?: TrustSection["items"];
  cols?: BreakpointCols;
  className?: string;
};

export default function SectionTrust(props: Props) {
  const title = props.title ?? "Perché scegliere noi";
  const items = props.items ?? [
    { title: "Spedizione gratuita", body: "Sopra 79€ (placeholder)", icon: "truck" },
    { title: "Qualità garantita", body: "Selezione premium (placeholder)", icon: "badge" },
    { title: "Supporto H24", body: "Assistenza rapida (placeholder)", icon: "support" },
  ];
  const cols = props.cols ?? { base: 1, sm: 3 };
  return (
    <section aria-label={title} className={props.className ?? "py-12"}>
      <Container>
        <div>
          <h2 className="text-2xl font-semibold text-text smart-wrap">{title}</h2>
        </div>

        <ResponsiveGrid cols={cols} className="mt-6">
          {items.map((it) => (
            <div key={it.title} className="flex gap-3 rounded-2xl border border-border bg-background p-5 shadow-sm">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-2">
                <Icon name={it.icon} />
              </div>
              <div>
                <div className="text-sm font-semibold text-text smart-wrap line-clamp-2">{it.title}</div>
                <p className="mt-1 text-sm text-muted-text smart-wrap line-clamp-3">{it.body}</p>
              </div>
            </div>
          ))}
        </ResponsiveGrid>
      </Container>
    </section>
  );
}
