/**
 * Read-only view of a store for public (non-GM) visitors. Private data (GM
 * notes, publication audit) reads as empty and every write is refused. This
 * is defense in depth: Row Level Security already blocks these for anon.
 */
import { filterForAudience, type Audience } from "@/lib/domain/audience";
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

/**
 * `audience` scopes what published lore can be read (see domain/audience.ts);
 * "gm" leaves it unfiltered (the project's open preview).
 */
export function readOnlyStore(inner: Store, audience: Audience = "gm"): Store {
  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (prop === "listGmNotes" || prop === "listPublicationEvents") return async () => [];
      if (audience !== "gm" && prop === "getActiveState") {
        return async () => filterForAudience(await target.getActiveState(), audience);
      }
      if (audience !== "gm" && prop === "getReleaseState") {
        return async (id: string) => {
          const s = await target.getReleaseState(id);
          return s ? filterForAudience(s, audience) : null;
        };
      }
      if (audience !== "gm" && (prop === "listReleases" || prop === "listChecklistItems")) return async () => [];
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
