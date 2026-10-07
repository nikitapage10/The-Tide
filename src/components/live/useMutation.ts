"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { api, messageFor, type ApiError } from "@/lib/client/api";

/** Runs a mutation, then refetches server data (router.refresh). Exposes errors for accessible display. */
export function useMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function run<T>(path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<T | null> {
    setBusy(true);
    setError(null);
    const res = await api<T>(path, method, body);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return null;
    }
    startTransition(() => router.refresh());
    return res.data;
  }

  return {
    run,
    busy: busy || pending,
    error,
    errorMessage: error ? messageFor(error) : null,
    fieldErrors: (error?.details?.fieldErrors ?? {}) as Record<string, string>,
    clearError: () => setError(null),
    reload: () => window.location.reload(),
  };
}
