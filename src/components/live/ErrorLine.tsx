"use client";
export function ErrorLine({ message, conflict, onReload }: { message: string | null; conflict?: boolean; onReload?: () => void }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-2 rounded-md border border-danger/60 bg-danger/5 px-3 py-2 text-sm text-danger">
      {message}
      {conflict && onReload ? (
        <button type="button" onClick={onReload} className="ml-2 underline">
          Reload
        </button>
      ) : null}
    </div>
  );
}
