import { requireAdmin } from "@/lib/auth.server";

export default async function AdminPage() {
  const me = await requireAdmin("/admin");

  return (
    <main style={{ padding: 24 }}>
      <h1>Area Admin</h1>
      <p>Benvenuto {me.username} (ruolo: {me.role?.name})</p>
    </main>
  );
}
