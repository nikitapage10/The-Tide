import type { Metadata } from "next";
import { OrbitSketch } from "@/components/lab/OrbitSketch";

export const metadata: Metadata = { title: "Orbit sketch" };

/** A scratch page for drawing how things should move around the planet. */
export default function OrbitSketchPage() {
  return <OrbitSketch />;
}
