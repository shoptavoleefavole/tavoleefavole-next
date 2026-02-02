import Link from "next/link";
import { cn } from "@/components/ui/cn";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  ariaLabel?: string;
};

export default function ButtonLink({ href, children, variant = "primary", className, ariaLabel }: Props) {
  const base =
    "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  const styles =
    variant === "secondary"
      ? "border border-border bg-background text-text hover:bg-surface-2"
      : "bg-primary text-primary-contrast hover:bg-primary-hover active:bg-primary-active";

  return (
    <Link href={href} className={cn(base, styles, className)} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
