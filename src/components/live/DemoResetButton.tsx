"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export function DemoResetButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen} title="Reset demo data?" description="Restores the seeded fixtures in the local demo file. This removes your demo changes on this machine." trigger={<Button variant="danger">Reset demo data</Button>}>
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={async () => {
              const res = await api("/api/v1/demo/reset", "POST", {});
              setOpen(false);
              setMsg(res.ok ? "Demo data reset." : res.error.message);
              if (res.ok) {
                router.push("/");
                router.refresh();
              }
            }}
          >
            Reset
          </Button>
        </div>
      </Dialog>
      <p aria-live="polite" className="mt-2 text-sm text-muted">
        {msg}
      </p>
    </>
  );
}
