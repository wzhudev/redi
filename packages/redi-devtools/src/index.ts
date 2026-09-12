/** The canonical package name, useful to identify this devtools integration. */
export const REDI_DEVTOOLS_PACKAGE_NAME = '@wendellhu/redi-devtools' as const;

export type {
  GraphCluster,
  GraphDependency,
  GraphEdge,
  GraphEdgeOutcome,
  GraphGroup,
  GraphModel,
  GraphRegistration,
} from './graph/model';
export {
  filterGraphByRoot,
  projectDependencyGraph,
  type ProjectDependencyGraphOptions,
} from './graph/project';
export {
  type DebuggerHandle,
  setupDebugger,
  type SetupDebuggerOptions,
} from './overlay';
export { DebuggerPanel, type DebuggerPanelProps } from './ui/DebuggerPanel';
