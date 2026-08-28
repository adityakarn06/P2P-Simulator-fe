import { create } from "zustand";
import type { DateRangePreset } from "@/lib/state/analytics-state";
import type { AnomalySeverity, AnomalySignalType } from "@/types/analytics";

/** Sentinel for the "no filter" option in each anomaly select. */
export const ANOMALY_FILTER_ALL = "__all__" as const;
type AllOption = typeof ANOMALY_FILTER_ALL;

interface DashboardState {
  /**
   * Defaults to "all". The analytics endpoints deliberately have no default
   * window, so a dashboard must not silently present a rolling 30 days as if
   * it were the whole history — the range is always an explicit choice.
   */
  range: DateRangePreset;
  severity: AnomalySeverity | AllOption;
  signalType: AnomalySignalType | AllOption;
  setRange: (v: DateRangePreset) => void;
  setSeverity: (v: AnomalySeverity | AllOption) => void;
  setSignalType: (v: AnomalySignalType | AllOption) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  range: "all",
  severity: ANOMALY_FILTER_ALL,
  signalType: ANOMALY_FILTER_ALL,
  setRange: (range) => set({ range }),
  setSeverity: (severity) => set({ severity }),
  setSignalType: (signalType) => set({ signalType }),
}));
