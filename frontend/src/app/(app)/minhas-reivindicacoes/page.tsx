import type { Metadata } from "next";
import { MyClaimsScreen } from "@/components/claims/MyClaimsScreen";

export const metadata: Metadata = { title: "Minhas reivindicações" };

export default function MyClaimsPage() {
  return <MyClaimsScreen />;
}
