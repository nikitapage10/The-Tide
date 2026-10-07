"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BUILD_CATEGORIES, BUILD_STATUSES, type BuildRecord } from "@/lib/domain/types";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input, Select, Textarea, describedBy } from "@/components/ui/Field";
import { ErrorLine } from "./ErrorLine";
import { LinkPicker, type LinkOption } from "./LinkPicker";
import { useCanEdit } from "@/components/shell/EditAccess";
import { useMutation } from "./useMutation";

export function BuildDialog(props: { build?: BuildRecord; linkOptions: LinkOption[]; triggerLabel: string }) {
  return useCanEdit() ? <BuildDialogInner {...props} /> : null;
}

function BuildDialogInner({ build, linkOptions, triggerLabel }: { build?: BuildRecord; linkOptions: LinkOption[]; triggerLabel: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const m = useMutation();
  const [f, setF] = useState(() => ({
    title: build?.title ?? "",
    category: build?.category ?? "physical",
    purpose: build?.purpose ?? "",
    status: build?.status ?? "idea",
    notes: build?.notes ?? "",
    links: build?.links.map((l) => `${l.label} | ${l.url}`).join("\n") ?? "",
    linkedRecordIds: build?.linkedRecordIds ?? [],
  }));
  const fe = m.fieldErrors;
  const linkErr = Object.entries(fe).find(([k]) => k.startsWith("links"))?.[1];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const links = f.links
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [label, url] = l.includes("|") ? l.split("|").map((s) => s.trim()) : ["Link", l];
        return { label: label || "Link", url: url ?? "" };
      });
    const body = { title: f.title, category: f.category, purpose: f.purpose.trim() || null, status: f.status, notes: f.notes.trim() || null, links, linkedRecordIds: f.linkedRecordIds };
    const res = build
      ? await m.run<{ build: BuildRecord }>(`/api/v1/builds/${build.id}`, "PATCH", { expectedRevision: build.revision, ...body })
      : await m.run<{ build: BuildRecord }>("/api/v1/builds", "POST", body);
    if (res) {
      setOpen(false);
      if (!build) router.push(`/workshop/builds/${res.build.id}`);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={build ? "Edit build" : "New build"}
      description="A practical record for a physical creation, code, logic or dashboard work."
      trigger={<Button variant={build ? "secondary" : "primary"}>{triggerLabel}</Button>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field id="b-title" label="Title" error={fe.title}>
          <Input id="b-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} aria-invalid={Boolean(fe.title)} aria-describedby={describedBy("b-title", undefined, fe.title)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="b-cat" label="Category">
            <Select id="b-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as BuildRecord["category"] })}>
              {BUILD_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field id="b-status" label="Status">
            <Select id="b-status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as BuildRecord["status"] })}>
              {BUILD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field id="b-purpose" label="Purpose">
          <Textarea id="b-purpose" rows={2} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} />
        </Field>
        <Field id="b-links" label="Source and file links" hint="One per line: “Label | https://…”" error={linkErr}>
          <Textarea id="b-links" rows={3} value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} aria-invalid={Boolean(linkErr)} aria-describedby={describedBy("b-links", "x", linkErr)} />
        </Field>
        <Field id="b-notes" label="Notes">
          <Textarea id="b-notes" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        <LinkPicker id="b-related" legend="Related story or lore" options={linkOptions} value={f.linkedRecordIds} onChange={(ids) => setF({ ...f, linkedRecordIds: ids })} />
        <ErrorLine message={Object.keys(fe).length ? "Please fix the highlighted fields." : m.errorMessage} conflict={m.error?.code === "REVISION_CONFLICT"} onReload={m.reload} />
        <div className="flex justify-end gap-2">
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={m.busy}>
            {build ? "Save changes" : "Create build"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function BuildVersionForm({ build }: { build: BuildRecord }) {
  return useCanEdit() ? <BuildVersionFormInner build={build} /> : null;
}

function BuildVersionFormInner({ build }: { build: BuildRecord }) {
  const m = useMutation();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (await m.run(`/api/v1/builds/${build.id}/versions`, "POST", { expectedRevision: build.revision, label, url: url.trim() || null, note: note.trim() || null })) {
          setLabel("");
          setUrl("");
          setNote("");
        }
      }}
    >
      <Field id="v-label" label="Version label" error={m.fieldErrors.label}>
        <Input id="v-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. v2, test print 3" />
      </Field>
      <Field id="v-url" label="Link" hint="Optional" error={m.fieldErrors.url}>
        <Input id="v-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      </Field>
      <Field id="v-note" label="Note" className="sm:col-span-2">
        <Input id="v-note" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" variant="primary" disabled={m.busy || !label.trim()}>
          Record version
        </Button>
        <ErrorLine message={m.errorMessage} conflict={m.error?.code === "REVISION_CONFLICT"} onReload={m.reload} />
      </div>
    </form>
  );
}
