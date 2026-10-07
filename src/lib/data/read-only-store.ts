/**
 * Read-only view of a store for public (non-GM) visitors. Private data (GM
 * notes, publication audit) reads as empty and every write is refused. This
 * is defense in depth: Row Level Security already blocks these for anon.
 */
import { DomainError } from "@/lib/domain/errors";
import type { OperationalStore, PublicationStore } from "@/lib/domain/ports";

type Store = PublicationStore & OperationalStore;

const WRITES = new Set<keyof Store>([
  "commitRelease",
  "recordPublicationEvent",
  "saveSessionState",
  "insertChecklistItem",
  "saveChecklistItem",
  "deleteChecklistItem",
  "insertGmNote",
  "insertPrintJob",
  "savePrintJob",
  "recordPrintAttempt",
  "insertBuild",
  "saveBuild",
  "insertActivity",
]);

export function readOnlyStore(inner: Store): Store {
  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (prop === "listGmNotes" || prop === "listPublicationEvents") return async () => [];
      if (WRITES.has(prop as keyof Store)) {
        return async () => {
          throw new DomainError("UNAUTHENTICATED", "Sign in as the GM to make changes.");
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
