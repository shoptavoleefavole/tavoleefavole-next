import { cn } from "@/components/ui/cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
};

export default function Button({ variant = "primary", className, ...props }: Props) {
  const base =
    "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-not-allowed";
  const styles =
    variant === "secondary"
      ? "border border-border bg-background text-text hover:bg-surface-2"
      : "bg-primary text-primary-contrast hover:bg-primary-hover active:bg-primary-active";

  return <button className={cn(base, styles, className)} {...props} />;
}
