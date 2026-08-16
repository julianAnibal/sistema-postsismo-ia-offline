import type { Metadata } from "next";
import FieldReviewConsole from "@/components/field/FieldReviewConsole";

export const metadata: Metadata = {
  title: "Revisión de campo | 1000 ojos",
  robots: { index: false, follow: false },
};

export default function FieldReviewPage() {
  return <FieldReviewConsole />;
}
