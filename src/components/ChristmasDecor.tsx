// src/components/ChristmasDecor.tsx

const IS_CHRISTMAS =
  String(process.env.NEXT_PUBLIC_SITE_THEME ?? "").trim().toLowerCase() === "christmas";

const FLAKES = [
  { left: "4%", size: "13px", duration: "15s", delay: "0s", char: "❄" },
  { left: "14%", size: "10px", duration: "19s", delay: "3s", char: "✦" },
  { left: "26%", size: "14px", duration: "17s", delay: "6s", char: "❄" },
  { left: "39%", size: "11px", duration: "21s", delay: "1.5s", char: "✦" },
  { left: "53%", size: "13px", duration: "16s", delay: "4.5s", char: "❄" },
  { left: "67%", size: "10px", duration: "20s", delay: "2s", char: "✦" },
  { left: "79%", size: "14px", duration: "18s", delay: "7s", char: "❄" },
  { left: "91%", size: "11px", duration: "15.5s", delay: "5s", char: "✦" },
] as const;

export default function ChristmasDecor() {
  if (!IS_CHRISTMAS) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {FLAKES.map((f, idx) => (
        <span
          key={idx}
          className="tf-snowflake"
          style={{
            left: f.left,
            fontSize: f.size,
            animationDuration: f.duration,
            animationDelay: f.delay,
          }}
        >
          {f.char}
        </span>
      ))}
    </div>
  );
}