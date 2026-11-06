"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, messageFor } from "@/lib/client/api";
import { Markdown } from "@/components/ui/Markdown";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import { Notice } from "@/components/ui/States";
import type { WorkingDraft } from "@/lib/domain/drafts";
import { WORKING_DRAFT_TAG } from "@/lib/domain/drafts";
export function DraftEditor({
  record,
  versionId,
}: {
  record: WorkingDraft;
  versionId: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(record.title),
    [summary, setSummary] = useState(record.summary ?? ""),
    [body, setBody] = useState(record.body ?? "");
  const [kind, setKind] = useState<string>(
      record.type === "story" ? record.format : record.kind,
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  async function save() {
    setBusy(true);
    setError("");
    setSaved(false);
    const next = {
      ...record,
      title: title.trim(),
      summary: summary.trim() || null,
      body: body || null,
      visibility: "gm_only",
      canonStatus: "unverified",
      demo: false,
      tags: [...new Set([...(record.tags ?? []), WORKING_DRAFT_TAG])],
    };
    if (next.type === "story") next.format = kind as typeof next.format;
    else next.kind = kind as typeof next.kind;
    const res = await api<{ draftId: string }>("/api/v1/codex-drafts", "POST", {
      action: "save",
      record: next,
      parentVersionId: versionId,
    });
    setBusy(false);
    if (!res.ok) {
      setError(messageFor(res.error));
      return;
    }
    setSaved(true);
    router.push("/workshop/drafts/" + record.id);
    router.refresh();
  }
  return (
    <div className="space-y-6">
      <Notice title="Private working material">
        Every save keeps a revision in the GM’s private notes. Draft text stays
        separate from published lore.
      </Notice>
      <Field id="draft-title" label="Title">
        <Input
          id="draft-title"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field
        id="draft-kind"
        label={record.type === "story" ? "Story format" : "Category"}
      >
        <Select
          id="draft-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          {(record.type === "story"
            ? ["campaign", "short_fiction", "one_shot", "novel"]
            : [
                "place",
                "environment",
                "character",
                "faction",
                "institution",
                "world_mechanic",
                "concept",
                "other",
              ]
          ).map((k) => (
            <option key={k} value={k}>
              {k.replaceAll("_", " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="draft-summary" label="Summary">
        <Textarea
          id="draft-summary"
          rows={2}
          maxLength={500}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </Field>
      <Field
        id="draft-body"
        label="Working text"
        hint="Markdown is supported. Up to 8,000 characters per draft; split longer writing into scenes or sections."
      >
        <Textarea
          id="draft-body"
          rows={18}
          maxLength={8000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
      <details className="border border-border p-5">
        <summary className="cursor-pointer text-sm">
          Read the text preview
        </summary>
        <div className="reading mt-5">
          <Markdown>{body}</Markdown>
        </div>
      </details>
      <Button onClick={save} variant="primary" disabled={busy || !title.trim()}>
        {busy ? "Saving…" : "Save private draft"}
      </Button>
      {error && (
        <Notice title="Unable to save" tone="danger">
          {error} Your text remains in this editor. Copy it before reloading.
        </Notice>
      )}
      {saved && (
        <Notice title="Draft saved" tone="ok">
          Your private revision has been kept.
        </Notice>
      )}
    </div>
  );
}
export function DraftDiscussion({
  id,
  notes,
}: {
  id: string;
  notes: { id: string; body: string; authorLabel: string; createdAt: string }[];
}) {
  const router = useRouter();
  const [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const r = await api("/api/v1/codex-drafts", "POST", {
            action: "comment",
            draftId: id,
            body,
          });
          setBusy(false);
          if (!r.ok) {
            setError(messageFor(r.error));
            return;
          }
          setBody("");
          router.refresh();
        }}
      >
        <label htmlFor="draft-comment" className="block text-sm">
          Add a development note
        </label>
        <Textarea
          id="draft-comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={7000}
        />
        <Button type="submit" disabled={busy || !body.trim()}>
          Save note
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <ul className="mt-5 space-y-5">
        {notes.map((n) => (
          <li key={n.id} className="border-t border-border pt-4">
            <p className="whitespace-pre-wrap text-sm text-muted">{n.body}</p>
            <p className="mt-2 text-xs text-faint">
              {n.authorLabel} ·{" "}
              {new Date(n.createdAt).toLocaleDateString("en-GB", {
                timeZone: "UTC",
              })}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
