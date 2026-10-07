"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Report only the digest; never the message (could contain data).
    console.error("page error", error.digest);
  }, [error]);
  return (
    <div role="alert" className="space-y-3 rounded-[var(--radius)] border border-danger/60 bg-danger/5 p-6">
      <h1 className="text-2xl">Something went wrong loading this page</h1>
      <p className="text-muted">The data source may be unavailable. Nothing was changed. {error.digest ? `Reference: ${error.digest}` : null}</p>
      <Button variant="primary" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
