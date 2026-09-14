export interface ReactPerfEvent {
  instanceId: number;
  typeId: number;
  rootId: number;
  rendererId: number;
  commitId: number;
  name: string;
  phase: 'mount' | 'update' | 'unmount';
  at: number;
  source: { file: string; line: number | null } | null;
}
export interface ReactPerfSnapshot {
  schemaVersion: 1;
  collector: 'bippy';
  collectorVersion: string;
  active: boolean;
  buildType: string;
  timeOrigin: number;
  epoch: number;
  startedAt: number;
  endedAt: number;
  renderers: { id: number; version: string | null; buildType: string }[];
  profilerSupported: boolean;
  observedCommit: boolean;
  observedComponent: boolean;
  commits: number;
  events: ReactPerfEvent[];
  profilerCommits: { id: string; phase: string; actualDuration: number; baseDuration: number; startTime: number; commitTime: number }[];
  droppedEvents: number;
  droppedProfilerCommits: number;
  errors: string[];
}
export interface ReactPerfApi {
  schemaVersion: 1;
  reset(): number;
  snapshot(): ReactPerfSnapshot;
  onProfilerRender(id: string, phase: 'mount' | 'update' | 'nested-update', actualDuration: number, baseDuration: number, startTime: number, commitTime: number): void;
  dispose(): void;
}
export function installCollector(options?: { buildType?: 'development' | 'profiling'; maxEvents?: number }): ReactPerfApi | null;
declare global {
  interface Window {
    __REACT_PERF__?: ReactPerfApi;
    __REACT_PERF_DISABLED__?: boolean;
  }
}
