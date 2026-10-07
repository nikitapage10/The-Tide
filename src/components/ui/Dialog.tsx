"use client";
/** Accessible modal dialog (Radix): focus trap, Escape to close, labelled title/description, focus return. */
import * as RD from "@radix-ui/react-dialog";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description?: string;
  trigger?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <RD.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <RD.Trigger asChild>{trigger}</RD.Trigger> : null}
      <RD.Portal>
        <RD.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <RD.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-xl border border-border-strong bg-surface p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(40rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <RD.Title className="font-[family-name:var(--font-display)] text-xl">{title}</RD.Title>
              {description ? <RD.Description className="mt-1 text-sm text-muted">{description}</RD.Description> : <RD.Description className="sr-only">{title}</RD.Description>}
            </div>
            <RD.Close className="rounded-md px-2 py-1 text-muted hover:bg-surface-2 hover:text-text" aria-label="Close dialog">
              ✕
            </RD.Close>
          </div>
          {children}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

export const DialogClose = RD.Close;
