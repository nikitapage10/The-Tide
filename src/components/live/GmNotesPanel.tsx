"use client";
import { useState } from "react";
import type { GmNote } from "@/lib/domain/types";
import { DemoBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorLine } from "./ErrorLine";
import { useCanEdit } from "@/components/shell/EditAccess";
import { useMutation } from "./useMutation";

export function GmNotesPanel({ subjectId, notes }: { subjectId: string; notes: GmNote[] }) {
  const m = useMutation();
  const canEdit = useCanEdit();
  const [body, setBody] = useState("");
  if (!canEdit) return <p className="text-sm text-faint">GM notes are private.</p>;
  return (
    <div className="space-y-3">
      <p className="text-xs text-faint">Private working notes. Append-only in this version. They never become published canon.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (body.trim() && (await m.run("/api/v1/gm-notes", "POST", { subjectId, body }))) setBody("");
        }}
        className="space-y-2"
      >
        <label htmlFor={`note-${subjectId}`} className="block text-sm font-medium">
          Add a GM note
        </label>
        <textarea
          id={`note-${subjectId}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={10000}
          rows={3}
          className="w-full rounded-md border border-border-strong bg-bg px-3 py-2"
        />
        <Button type="submit" variant="primary" disabled={m.busy || !body.trim()}>
          Save note
        </Button>
        <ErrorLine message={m.errorMessage} />
      </form>
      {notes.length ? (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border border-border bg-surface-2 p-3">
              <p className="whitespace-pre-wrap text-sm">{n.body}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-faint">
                {n.authorLabel} · <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</time>
                {n.demo ? <DemoBadge /> : null}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-faint">No GM notes yet.</p>
      )}
    </div>
  );
}
