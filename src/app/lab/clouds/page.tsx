import type { Metadata } from "next";
import { CloudLab } from "@/components/lab/CloudLab";

export const metadata: Metadata = { title: "Cloud lab" };

/** A standalone playground for trying different cloud interaction models. */
export default function CloudLabPage() {
  return <CloudLab />;
}
