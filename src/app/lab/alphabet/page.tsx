import type { Metadata } from "next";
import { AlphabetLab } from "@/components/lab/AlphabetLab";

export const metadata: Metadata = { title: "Alphabet lab" };

/** A standalone page comparing ways for the Tide's script to translate into English. */
export default function AlphabetLabPage() {
  return <AlphabetLab />;
}
