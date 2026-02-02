import { redirect } from "next/navigation";
import { CURRENT_OCCASION_SLUG } from "@/lib/data";

export default function RicorrenzeIndex() {
  redirect(`/ricorrenze/${CURRENT_OCCASION_SLUG}`);
}
