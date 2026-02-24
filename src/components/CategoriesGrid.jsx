import Link from "next/link";
import Image from "next/image";
import { categories } from "@/data/categories";

export default function CategoriesGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/categoria/${c.slug}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: 16,
            border: "1px solid #eee",
            borderRadius: 16,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <Image src={c.icon} alt={c.label} width={40} height={40} sizes="40px" />
          <div style={{ fontWeight: 600 }}>{c.label}</div>
        </Link>
      ))}
    </div>
  );
}