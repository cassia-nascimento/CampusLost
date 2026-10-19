import type { Metadata } from "next";
import { ReturnsScreen } from "@/components/admin/ReturnsScreen";

export const metadata: Metadata = { title: "Devoluções" };

export default function ReturnsPage() {
  return <ReturnsScreen />;
}
