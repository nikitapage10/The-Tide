"use client";
/** Whether the current viewer may edit (GM) or only view (public visitor). UI only; the server enforces it. */
import { createContext, useContext } from "react";

const EditAccess = createContext(true);

export function EditAccessProvider({ canEdit, children }: { canEdit: boolean; children: React.ReactNode }) {
  return <EditAccess.Provider value={canEdit}>{children}</EditAccess.Provider>;
}

export function useCanEdit() {
  return useContext(EditAccess);
}
