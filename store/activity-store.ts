import { create } from "zustand";
import type { AuditAction, AuditActorType, EntityType } from "@/types/models";

/** Sentinel for the "no filter" option in each select. */
export const ACTIVITY_FILTER_ALL = "__all__" as const;
type AllOption = typeof ACTIVITY_FILTER_ALL;

interface ActivityState {
  actorType: AuditActorType | AllOption;
  entityType: EntityType | AllOption;
  action: AuditAction | AllOption;
  setActorType: (v: AuditActorType | AllOption) => void;
  setEntityType: (v: EntityType | AllOption) => void;
  setAction: (v: AuditAction | AllOption) => void;
  resetFilters: () => void;
}

export const useActivityStore = create<ActivityState>((set) => ({
  actorType: ACTIVITY_FILTER_ALL,
  entityType: ACTIVITY_FILTER_ALL,
  action: ACTIVITY_FILTER_ALL,
  setActorType: (actorType) => set({ actorType }),
  setEntityType: (entityType) => set({ entityType }),
  setAction: (action) => set({ action }),
  resetFilters: () =>
    set({
      actorType: ACTIVITY_FILTER_ALL,
      entityType: ACTIVITY_FILTER_ALL,
      action: ACTIVITY_FILTER_ALL,
    }),
}));
