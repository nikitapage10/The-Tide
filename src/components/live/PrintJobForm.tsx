"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LENGTH_UNITS, PRINT_PRIORITIES, PRINT_STATUSES, type PrintJob } from "@/lib/domain/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/Field";
import { ErrorLine } from "./ErrorLine";
import { LinkPicker, type LinkOption } from "./LinkPicker";
import { useCanEdit } from "@/components/shell/EditAccess";
import { useMutation } from "./useMutation";

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export function PrintJobDialog(props: { job?: PrintJob; linkOptions: LinkOption[]; triggerLabel: string }) {
  return useCanEdit() ? <PrintJobDialogInner {...props} /> : null;
}

function PrintJobDialogInner({ job, linkOptions, triggerLabel }: { job?: PrintJob; linkOptions: LinkOption[]; triggerLabel: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const m = useMutation();
  const [f, setF] = useState(() => ({
    title: job?.title ?? "",
    sourceUrl: job?.sourceUrl ?? "",
    requestedQuantity: String(job?.requestedQuantity ?? 1),
    completedQuantity: String(job?.completedQuantity ?? 0),
    status: job?.status ?? "planned",
    priority: job?.priority ?? "normal",
    notes: job?.notes ?? "",
    fileReference: job?.fileReference ?? "",
    fileFormat: job?.fileFormat ?? "",
    printerProfile: job?.printerProfile ?? "",
    material: job?.material ?? "",
    scale: job?.scale ?? "",
    dx: job?.dimensions?.x?.toString() ?? "",
    dy: job?.dimensions?.y?.toString() ?? "",
    dz: job?.dimensions?.z?.toString() ?? "",
    unit: job?.dimensions?.unit ?? "mm",
    estimatedMinutes: job?.estimatedMinutes?.toString() ?? "",
    actualMinutes: job?.actualMinutes?.toString() ?? "",
    linkedRecordIds: job?.linkedRecordIds ?? [],
  }));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const fe = m.fieldErrors;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const hasDims = f.dx || f.dy || f.dz;
    const body = {
      title: f.title,
      sourceUrl: f.sourceUrl.trim() || null,
      requestedQuantity: Number(f.requestedQuantity),
      completedQuantity: Number(f.completedQuantity),
      status: f.status,
      priority: f.priority,
      notes: f.notes.trim() || null,
      fileReference: f.fileReference.trim() || null,
      fileFormat: f.fileFormat.trim() || null,
      printerProfile: f.printerProfile.trim() || null,
      material: f.material.trim() || null,
      scale: f.scale.trim() || null,
      dimensions: hasDims ? { x: numOrNull(f.dx), y: numOrNull(f.dy), z: numOrNull(f.dz), unit: f.unit } : null,
      estimatedMinutes: numOrNull(f.estimatedMinutes),
      actualMinutes: numOrNull(f.actualMinutes),
      linkedRecordIds: f.linkedRecordIds,
    };
    const res = job
      ? await m.run<{ job: PrintJob }>(`/api/v1/print-jobs/${job.id}`, "PATCH", { expectedRevision: job.revision, ...body })
      : await m.run<{ job: PrintJob }>("/api/v1/print-jobs", "POST", body);
    if (res) {
      setOpen(false);
      if (!job) router.push(`/workshop/prints/${res.job.id}`);
    }
  }

  const input = (id: string, key: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string, errKey?: string) => (
    <Field id={id} label={label} hint={hint} error={fe[errKey ?? (key as string)]}>
      <Input id={id} value={f[key] as string} onChange={set(key)} aria-invalid={Boolean(fe[errKey ?? (key as string)])} aria-describedby={describedBy(id, hint, fe[errKey ?? (key as string)])} {...props} />
    </Field>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) m.clearError();
      }}
      title={job ? "Edit print job" : "New print job"}
      description="Links and metadata only. The dashboard does not upload models or control a printer. Leave unknown values blank."
      trigger={<Button variant={job ? "secondary" : "primary"}>{triggerLabel}</Button>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {input("pj-title", "title", "Title", { required: true, maxLength: 200 })}
        {input("pj-url", "sourceUrl", "Model or source link", { type: "url", inputMode: "url", placeholder: "https://…" }, "Optional. http(s) only.")}
        <div className="grid gap-3 sm:grid-cols-2">
          {input("pj-req", "requestedQuantity", "Requested quantity", { type: "number", min: 1, max: 10000, inputMode: "numeric", required: true })}
          {input(
            "pj-done",
            "completedQuantity",
            "Completed quantity",
            { type: "number", min: 0, max: 10000, inputMode: "numeric" },
            "Use “Record pieces” on the job page to log successes and failed reprints.",
          )}
          <Field id="pj-status" label="Status" error={fe.status}>
            <Select id="pj-status" value={f.status} onChange={set("status")} aria-invalid={Boolean(fe.status)} aria-describedby={describedBy("pj-status", undefined, fe.status)}>
              {PRINT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", "-")}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="pj-prio" label="Priority">
            <Select id="pj-prio" value={f.priority} onChange={set("priority")}>
              {PRINT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id="pj-notes" label="Notes" error={fe.notes}>
          <Textarea id="pj-notes" value={f.notes} onChange={set("notes")} rows={3} />
        </Field>
        <LinkPicker id="pj-links" legend="Linked lore, stories or sessions" options={linkOptions} value={f.linkedRecordIds} onChange={(ids) => setF({ ...f, linkedRecordIds: ids })} />
        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">Optional print details</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {input("pj-file", "fileReference", "File reference", {}, "Path or name; files are not uploaded.")}
            {input("pj-format", "fileFormat", "File format", { placeholder: "e.g. STL, 3MF" })}
            {input("pj-printer", "printerProfile", "Printer / profile")}
            {input("pj-material", "material", "Material")}
            {input("pj-scale", "scale", "Scale", { placeholder: "e.g. 32mm" })}
            <fieldset className="sm:col-span-2">
              <legend className="mb-1 text-sm font-medium">Dimensions</legend>
              <div className="grid grid-cols-4 gap-2">
                {(["dx", "dy", "dz"] as const).map((k, i) => (
                  <div key={k}>
                    <label htmlFor={`pj-${k}`} className="text-xs text-muted">
                      {["Width", "Depth", "Height"][i]}
                    </label>
                    <Input id={`pj-${k}`} type="number" min={0} step="any" value={f[k]} onChange={set(k)} />
                  </div>
                ))}
                <div>
                  <label htmlFor="pj-unit" className="text-xs text-muted">
                    Unit
                  </label>
                  <Select id="pj-unit" value={f.unit} onChange={set("unit")}>
                    {LENGTH_UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </Select>
                </div>
              </div>
              {fe["dimensions.x"] || fe["dimensions.y"] || fe["dimensions.z"] ? <p className="text-sm text-danger">Dimensions must be positive numbers.</p> : null}
            </fieldset>
            {input("pj-est", "estimatedMinutes", "Estimated duration (minutes)", { type: "number", min: 0, inputMode: "numeric" })}
            {input("pj-act", "actualMinutes", "Actual duration (minutes)", { type: "number", min: 0, inputMode: "numeric" })}
          </div>
        </details>
        <ErrorLine message={Object.keys(fe).length ? "Please fix the highlighted fields." : m.errorMessage} conflict={m.error?.code === "REVISION_CONFLICT"} onReload={m.reload} />
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={m.busy}>
            {job ? "Save changes" : "Create print job"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function PrintAttemptForm({ job }: { job: PrintJob }) {
  return useCanEdit() ? <PrintAttemptFormInner job={job} /> : <p className="text-sm text-faint">Sign in as the GM to record pieces.</p>;
}

function PrintAttemptFormInner({ job }: { job: PrintJob }) {
  const m = useMutation();
  const [outcome, setOutcome] = useState<"succeeded" | "failed">("succeeded");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const remaining = job.requestedQuantity - job.completedQuantity;
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await m.run(`/api/v1/print-jobs/${job.id}/attempts`, "POST", { expectedRevision: job.revision, outcome, quantity: Number(quantity), note: note.trim() || null })) {
          setNote("");
          setQuantity("1");
        }
      }}
      className="space-y-3"
      noValidate
    >
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Outcome</legend>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="outcome" checked={outcome === "succeeded"} onChange={() => setOutcome("succeeded")} className="accent-[var(--accent)]" /> Succeeded
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="outcome" checked={outcome === "failed"} onChange={() => setOutcome("failed")} className="accent-[var(--accent)]" /> Failed (needs reprint)
          </label>
        </div>
      </fieldset>
      <Field id="att-qty" label="Pieces" hint={outcome === "succeeded" ? `${remaining} remaining of ${job.requestedQuantity}` : "Failed pieces are tallied; the requested quantity does not change."} error={m.fieldErrors.quantity}>
        <Input
          id="att-qty"
          type="number"
          min={1}
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          aria-invalid={Boolean(m.fieldErrors.quantity)}
          aria-describedby={describedBy("att-qty", "x", m.fieldErrors.quantity)}
        />
      </Field>
      <Field id="att-note" label="Note" hint="Optional, e.g. what failed.">
        <Input id="att-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
      </Field>
      <Button type="submit" variant="primary" disabled={m.busy}>
        Record pieces
      </Button>
      <ErrorLine message={m.fieldErrors.quantity ? null : m.errorMessage} conflict={m.error?.code === "REVISION_CONFLICT"} onReload={m.reload} />
    </form>
  );
}
