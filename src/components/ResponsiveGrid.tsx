import type { ReactNode } from "react";

export type GridCols = {
  base?: number;
  sm?: number;
  md?: number;
  lg?: number;
};

export default function ResponsiveGrid({
  cols,
  className,
  children,
}: {
  cols?: GridCols;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={
        "rg gap-4 " +
        (className ?? "")
      }
      style={{
        // CSS vars let us keep Tailwind classes static and still configure columns via config/JSON.
        // Fallback chain is implemented in globals.css.
        ...(cols?.base ? ({ "--cols-base": cols.base } as any) : null),
        ...(cols?.sm ? ({ "--cols-sm": cols.sm } as any) : null),
        ...(cols?.md ? ({ "--cols-md": cols.md } as any) : null),
        ...(cols?.lg ? ({ "--cols-lg": cols.lg } as any) : null),
      }}
    >
      {children}
    </div>
  );
}
