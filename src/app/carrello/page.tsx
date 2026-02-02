import CartView from "@/components/cart/CartView";

export const dynamic = "force-dynamic";

export default function CarrelloPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-extrabold">Carrello</h1>
      <div className="mt-6">
        <CartView />
      </div>
    </main>
  );
}
