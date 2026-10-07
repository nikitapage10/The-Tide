"use client";
import { useState } from "react";
import { SESSION_STATUSES, type SessionState } from "@/lib/domain/types";
import { Button } from "@/components/ui/Button";
import { Field, Select, Input } from "@/components/ui/Field";
import { ErrorLine } from "./ErrorLine";
import { useMutation } from "./useMutation";

export function SessionStatePanel({ sessionId, state }: { sessionId: string; state: SessionState | null }) {
  const m = useMutation();
  const [status, setStatus] = useState(state?.status ?? "planned");
  const [scheduledFor, setScheduledFor] = useState(state?.scheduledFor ?? "");
  const [actualRunDate, setActualRunDate] = useState(state?.actualRunDate ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        const ok = await m.run(`/api/v1/sessions/${sessionId}/state`, "PATCH", {
          expectedRevision: state?.revision ?? 0,
          status,
          scheduledFor: scheduledFor || null,
          actualRunDate: actualRunDate || null,
        });
        if (ok) setSaved(true);
      }}
      className="grid gap-3 sm:grid-cols-3"
    >
      <Field id="sess-status" label="Status" error={m.fieldErrors.status}>
        <Select id="sess-status" value={status} onChange={(e) => setStatus(e.target.value as SessionState["status"])}>
          {SESSION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="sess-scheduled" label="Scheduled for" hint="Optional" error={m.fieldErrors.scheduledFor}>
        <Input id="sess-scheduled" type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
      </Field>
      <Field id="sess-run" label="Actual run date" hint="Optional" error={m.fieldErrors.actualRunDate}>
        <Input id="sess-run" type="date" value={actualRunDate} onChange={(e) => setActualRunDate(e.target.value)} />
      </Field>
      <div className="flex items-center gap-3 sm:col-span-3">
        <Button type="submit" variant="primary" disabled={m.busy}>
          Save session state
        </Button>
        <span aria-live="polite" className="text-sm text-ok">
          {saved && !m.busy ? "Saved." : ""}
        </span>
      </div>
      <div className="sm:col-span-3">
        <ErrorLine message={m.errorMessage} conflict={m.error?.code === "REVISION_CONFLICT"} onReload={m.reload} />
      </div>
    </form>
  );
}
