"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, messageFor, type ApiError } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/States";
import { useCanEdit } from "@/components/shell/EditAccess";

export function RollbackButton(props: { targetReleaseId: string; targetVersion: number; activeReleaseId: string | null }) {
  return useCanEdit() ? <RollbackInner {...props} /> : null;
}

function RollbackInner({ targetReleaseId, targetVersion, activeReleaseId }: { targetReleaseId: string; targetVersion: number; activeReleaseId: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // One release ID per dialog opening, so a retried click is idempotent.
  const [releaseId, setReleaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setReleaseId(crypto.randomUUID());
          setError(null);
        }
      }}
      title={`Roll back lore to version ${targetVersion}?`}
      description="Creates a new release whose published content matches that version. Entries added since then are archived, not deleted. Checklists, print jobs, builds, session state and GM notes are not changed."
      trigger={<Button className="min-h-8 px-2.5 py-1 text-xs">Roll back to this</Button>}
    >
      {error ? (
        <div className="mb-3">
          <Notice tone="danger" title={error.code}>
            {messageFor(error)}
          </Notice>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button onClick={() => setOpen(false)}>Cancel</Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await api("/api/v1/publications/rollback", "POST", { releaseId, targetReleaseId, expectedActiveReleaseId: activeReleaseId });
            setBusy(false);
            if (!res.ok) return setError(res.error);
            setOpen(false);
            router.refresh();
          }}
        >
          Create rollback release
        </Button>
      </div>
    </Dialog>
  );
}
