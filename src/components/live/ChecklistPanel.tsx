"use client";
import { useState } from "react";
import type { ChecklistItem } from "@/lib/domain/types";
import { DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorLine } from "./ErrorLine";
import { useCanEdit } from "@/components/shell/EditAccess";
import { useMutation } from "./useMutation";

export function ChecklistPanel({ subjectId, items, headingId }: { subjectId: string; items: ChecklistItem[]; headingId: string }) {
  const m = useMutation();
  const canEdit = useCanEdit();
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  // Optimistic completion state, valid only while the item's revision is unchanged.
  const [optimistic, setOptimistic] = useState<Record<string, { done: boolean; rev: number }>>({});
  const isDone = (i: ChecklistItem) => (optimistic[i.id]?.rev === i.revision ? optimistic[i.id]!.done : i.done);
  const done = items.filter(isDone).length;

  async function toggle(item: ChecklistItem, next: boolean) {
    setOptimistic((o) => ({ ...o, [item.id]: { done: next, rev: item.revision } }));
    const ok = await m.run(`/api/v1/checklist-items/${item.id}`, "PATCH", { expectedRevision: item.revision, done: next });
    if (!ok)
      setOptimistic((o) => {
        const next = { ...o };
        delete next[item.id];
        return next;
      });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    if (await m.run("/api/v1/checklist-items", "POST", { subjectId, label })) setLabel("");
  }

  return (
    <div>
      <p className="mb-2 text-sm text-muted" aria-live="polite">
        {items.length ? `${done} of ${items.length} done` : "No prep items yet."}
      </p>
      {items.length ? (
        <ul className="mb-3 divide-y divide-border rounded-md border border-border" aria-labelledby={headingId}>
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              {editing === item.id ? (
                <form
                  className="flex w-full flex-wrap gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await m.run(`/api/v1/checklist-items/${item.id}`, "PATCH", { expectedRevision: item.revision, label: editLabel })) setEditing(null);
                  }}
                >
                  <label htmlFor={`edit-${item.id}`} className="sr-only">
                    Edit prep item
                  </label>
                  <input
                    id={`edit-${item.id}`}
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="min-h-10 flex-1 rounded-md border border-border-strong bg-bg px-3"
                    autoFocus
                  />
                  <Button type="submit" variant="primary" disabled={m.busy}>
                    Save
                  </Button>
                  <Button onClick={() => setEditing(null)}>Cancel</Button>
                </form>
              ) : (
                <>
                  <input
                    id={`ck-${item.id}`}
                    type="checkbox"
                    checked={isDone(item)}
                    disabled={m.busy || !canEdit}
                    onChange={(e) => void toggle(item, e.target.checked)}
                    className="h-5 w-5 accent-[var(--accent)]"
                  />
                  <label htmlFor={`ck-${item.id}`} className={isDone(item) ? "flex-1 text-muted line-through" : "flex-1"}>
                    {item.label}
                  </label>
                  {item.demo ? <DemoBadge /> : null}
                  {canEdit ? (
                  <>
                  <Button
                    variant="ghost"
                    className="min-h-8 px-2 py-1"
                    onClick={() => {
                      setEditing(item.id);
                      setEditLabel(item.label);
                    }}
                    aria-label={`Rename “${item.label}”`}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    className="min-h-8 px-2 py-1"
                    onClick={() => {
                      if (window.confirm(`Remove “${item.label}”?`)) void m.run(`/api/v1/checklist-items/${item.id}`, "DELETE", { expectedRevision: item.revision });
                    }}
                    aria-label={`Remove “${item.label}”`}
                  >
                    Remove
                  </Button>
                  </>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <label htmlFor={`new-${subjectId}`} className="sr-only">
          New prep item
        </label>
        <input
          id={`new-${subjectId}`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Add a prep item"
          maxLength={300}
          className="min-h-10 flex-1 rounded-md border border-border-strong bg-bg px-3"
        />
        <Button type="submit" variant="primary" disabled={m.busy || !label.trim()}>
          Add
        </Button>
      </form>
      ) : null}
      <ErrorLine message={m.errorMessage} conflict={m.error?.code === "REVISION_CONFLICT"} onReload={m.reload} />
    </div>
  );
}
