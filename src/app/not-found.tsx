import Link from "next/link";
import { Plain } from "@/components/shell/Plain";

export default function NotFound() {
  return (
    <Plain title="Page not found">
      <Link href="/">Return home</Link>
    </Plain>
  );
}
