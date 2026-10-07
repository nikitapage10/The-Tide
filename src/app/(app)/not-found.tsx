import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-3">
      <p className="eyebrow">404</p>
      <h1 className="text-3xl">This record is not in the archive</h1>
      <p className="text-muted">It may never have been published, or the link may be wrong. Archived and removed records keep their pages, so this ID is unknown.</p>
      <Link href="/">Return home</Link>
    </div>
  );
}
