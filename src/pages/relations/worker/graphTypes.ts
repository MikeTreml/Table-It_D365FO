export interface GraphNode {
  name: string;
  type: string;
  module: string;
}

export interface GraphEdge {
  source: string;
  source_type: string;
  source_module: string;
  target: string;
  cardinality: string;
  target_cardinality: string;
  relationship_type: string;
  join_expr: string;
}

export interface PathStep {
  edge: GraphEdge;
  reversed: boolean;
  from: string;
  to: string;
}

export interface Path {
  hops: number;
  nodes: string[];
  steps: PathStep[];
  cardinalitySummary: string;
}

export interface GroupedPath {
  hops: number;
  nodes: string[];
  variants: Path[];
  variantCount: number;
}

export interface Filters {
  moduleExclude: string[];
  countryExclude: string[];
  allowedTypes: string[];
  allowedConnections: number[];
  hideTempTables: boolean;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  moduleCount: number;
  typeCount: number;
}

export type WorkerRequest =
  | { type: 'LOAD' }
  | { type: 'SEARCH'; start: string; end: string; filters: Filters };

export type WorkerResponse =
  | { type: 'LOAD_PROGRESS'; phase: string }
  | { type: 'LOAD_COMPLETE'; stats: GraphStats; nodes: GraphNode[]; modules: string[]; types: string[]; countries: string[] }
  | { type: 'RESULTS'; paths: GroupedPath[]; durationMs: number }
  | { type: 'ERROR'; message: string };
