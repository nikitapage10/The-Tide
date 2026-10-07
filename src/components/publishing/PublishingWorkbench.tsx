"use client";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import type { ChangeEntry, Issue, Preview } from "@/lib/domain/publication";
import type { ReleaseInfo } from "@/lib/domain/types";
import { api, messageFor, type ApiError } from "@/lib/client/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/States";

const CHANGE_TONE = { added: "ok", changed: "info", unchanged: "neutral", archived: "warn", restored: "accent", tombstoned: "danger" } as const;

function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length) return <p className="text-sm text-ok">No problems found.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {issues.map((i, n) => (
        <li key={n} className="flex flex-wrap items-baseline gap-2">
          <Badge tone={i.severity === "error" ? "danger" : i.severity === "warning" ? "warn" : "info"}>{i.severity}</Badge>
          <code className="text-xs text-faint">{i.code}</code>
          <span>{i.message}</span>
          {i.path ? <code className="text-xs text-faint">at {i.path}</code> : null}
        </li>
      ))}
    </ul>
  );
}

function ChangeList({ changes, empty }: { changes: ChangeEntry[]; empty: string }) {
  const visible = changes.filter((c) => c.change !== "unchanged");
  if (!visible.length) return <p className="text-sm text-faint">{empty}</p>;
  return (
    <ul className="divide-y divide-border rounded-md border border-border text-sm">
      {visible.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
          <Badge tone={CHANGE_TONE[c.change]}>{c.change}</Badge>
          <span className="font-medium">{c.title}</span>
          <span className="text-faint">{c.type.replace("_", " ")}</span>
          {c.changedFields.length ? <span className="w-full text-xs text-faint">Fields: {c.changedFields.join(", ")}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function PreviewView({ preview }: { preview: Preview }) {
  const c = preview.counts;
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-2 text-center text-sm sm:grid-cols-6">
        {(["added", "changed", "archived", "restored", "tombstoned", "unchanged"] as const).map((k) => (
          <div key={k} className="rounded-md border border-border p-2">
            <dt className="text-xs text-faint">{k}</dt>
            <dd className="text-lg font-semibold">{c[k]}</dd>
          </div>
        ))}
      </dl>
      <section aria-labelledby="pv-issues">
        <h3 id="pv-issues" className="mb-2 font-medium">
          Validation
        </h3>
        <IssueList issues={preview.issues} />
      </section>
      <section aria-labelledby="pv-changes">
        <h3 id="pv-changes" className="mb-2 font-medium">
          Record changes
        </h3>
        <ChangeList changes={preview.changes} empty="No record changes." />
      </section>
      <section aria-labelledby="pv-rel">
        <h3 id="pv-rel" className="mb-2 font-medium">
          Relationship changes
        </h3>
        <ChangeList changes={preview.relationshipChanges} empty="No relationship changes." />
      </section>
      <section aria-labelledby="pv-gaps">
        <h3 id="pv-gaps" className="mb-2 font-medium">
          Source gaps
        </h3>
        {preview.sourceGaps.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {preview.sourceGaps.map((g) => (
              <li key={g.id}>
                <span className="text-text">{g.title}</span>: {g.reason}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-faint">None.</p>
        )}
      </section>
      {preview.bundleHash ? (
        <p className="break-all text-xs text-faint">
          Bundle hash: <code>{preview.bundleHash}</code> · base: <code>{preview.baseReleaseId ?? "none"}</code> · active: <code>{preview.activeReleaseId ?? "none"}</code>
        </p>
      ) : null}
    </div>
  );
}

export function PublishingWorkbench({ exampleBundle }: { exampleBundle: string | null }) {
  const router = useRouter();
  const textId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [previewedText, setPreviewedText] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<{ status: string; release: ReleaseInfo } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const stale = preview !== null && previewedText !== text;

  async function validate() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await api<{ preview: Preview }>("/api/v1/publications/validate", "POST", text);
    setBusy(false);
    if (!res.ok) {
      setPreview(null);
      setError(res.error);
      return;
    }
    setPreview(res.data.preview);
    setPreviewedText(text);
  }

  async function publish() {
    setBusy(true);
    setError(null);
    const res = await api<{ status: string; release: ReleaseInfo }>("/api/v1/publications/publish", "POST", text);
    setBusy(false);
    setConfirmOpen(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setResult(res.data);
    setPreview(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label htmlFor={textId} className="block font-medium">
          Publication bundle (JSON)
        </label>
        <p className="text-sm text-muted">Paste a bundle that follows the tide.publication.v1 contract, or load a .json file. Validating never changes data.</p>
        <textarea
          id={textId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          rows={12}
          className="w-full rounded-md border border-border-strong bg-bg p-3 font-mono text-sm"
          placeholder='{ "schemaVersion": "tide.publication.v1", … }'
        />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            id="bundle-file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setText(await f.text());
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>Load .json file</Button>
          {exampleBundle ? <Button onClick={() => setText(exampleBundle)}>Insert example bundle (demo)</Button> : null}
          <Button variant="primary" onClick={validate} disabled={busy || !text.trim()}>
            Validate & preview
          </Button>
        </div>
      </div>

      {error ? (
        <Notice tone="danger" title={error.code}>
          {messageFor(error)}
          {Array.isArray(error.details?.issues) ? (
            <div className="mt-2">
              <IssueList issues={error.details.issues as Issue[]} />
            </div>
          ) : null}
        </Notice>
      ) : null}

      {result ? (
        <Notice tone="ok" title={result.status === "replayed" ? "Already published (idempotent retry)" : "Release published"}>
          Version {result.release.version} ({result.release.id}) is now {result.status === "replayed" ? "recorded" : "active"}. Live checklists, prints and session state were not changed.
        </Notice>
      ) : null}

      {preview ? (
        <section aria-labelledby="preview-heading" className="rounded-[var(--radius)] border border-border bg-surface p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="preview-heading" className="text-xl">
              Preview {preview.ok ? <Badge tone="ok">ready to publish</Badge> : <Badge tone="danger">cannot publish</Badge>}
            </h2>
            <Dialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title="Publish this release?"
              description="This switches the active published lore for everyone with access. Live records are not affected. You can roll back later as a new release."
              trigger={
                <Button variant="primary" disabled={!preview.ok || stale || busy}>
                  Publish release
                </Button>
              }
            >
              <p className="mb-4 text-sm">
                {preview.counts.added} added, {preview.counts.changed} changed, {preview.counts.archived} archived, {preview.counts.restored} restored, {preview.counts.tombstoned} removed.
              </p>
              <div className="flex justify-end gap-2">
                <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={publish} disabled={busy}>
                  Confirm publish
                </Button>
              </div>
            </Dialog>
          </div>
          {stale ? (
            <div className="mb-3">
              <Notice tone="warn">The bundle text changed after this preview. Validate again before publishing.</Notice>
            </div>
          ) : null}
          <PreviewView preview={preview} />
        </section>
      ) : null}
    </div>
  );
}
