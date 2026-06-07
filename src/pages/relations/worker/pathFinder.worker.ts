/// <reference lib="webworker" />
import type {
  Filters,
  GraphEdge,
  GraphNode,
  GroupedPath,
  Path,
  PathStep,
  WorkerRequest,
  WorkerResponse,
} from './graphTypes';
import {
  RELATION_COUNTRY_CODES,
  isCountryScopedTable,
  isQueryNode,
  isTempTableNode,
} from '../relationFilters';

declare const self: DedicatedWorkerGlobalScope;

interface AdjacencyEntry {
  edge: GraphEdge;
  neighbor: string;
  reversed: boolean;
}

interface GraphState {
  nodes: GraphNode[];
  nodeByName: Map<string, GraphNode>;
  modules: string[];
  types: string[];
  countries: string[];
  adjacency: Map<string, AdjacencyEntry[]>;
}

let graph: GraphState | null = null;

function post(msg: WorkerResponse) {
  self.postMessage(msg);
}

async function loadAsset<T>(name: string): Promise<T> {
  const url = (self as unknown as { location: Location }).location.origin + '/assets/data/' + name;
  // chrome.runtime.getURL isn't available in a plain worker; assets ship under the extension origin.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${name}: ${res.status}`);
  return (await res.json()) as T;
}

async function loadGraph() {
  post({ type: 'LOAD_PROGRESS', phase: 'Fetching nodes' });
  const allNodes = await loadAsset<GraphNode[]>('relations-nodes.json');
  const nodes = allNodes.filter((node) => !isQueryNode(node));
  const nodeNameSet = new Set(nodes.map((node) => node.name));
  post({ type: 'LOAD_PROGRESS', phase: 'Fetching modules' });
  const modules = await loadAsset<string[]>('relations-modules.json');
  post({ type: 'LOAD_PROGRESS', phase: 'Fetching types' });
  const types = (await loadAsset<string[]>('relations-types.json')).filter((type) => type !== 'AxQuery');
  post({ type: 'LOAD_PROGRESS', phase: 'Fetching edges' });
  const edges = await loadAsset<GraphEdge[]>('relations-edges.json');

  post({ type: 'LOAD_PROGRESS', phase: 'Building adjacency' });
  const adjacency = new Map<string, AdjacencyEntry[]>();
  const push = (key: string, entry: AdjacencyEntry) => {
    const list = adjacency.get(key);
    if (list) list.push(entry);
    else adjacency.set(key, [entry]);
  };
  for (const edge of edges) {
    if (!nodeNameSet.has(edge.source) || !nodeNameSet.has(edge.target)) continue;
    push(edge.source, { edge, neighbor: edge.target, reversed: false });
    push(edge.target, { edge, neighbor: edge.source, reversed: true });
  }

  const nodeByName = new Map<string, GraphNode>();
  for (const n of nodes) {
    // Same name can exist with multiple types; keep the first deterministically.
    if (!nodeByName.has(n.name)) nodeByName.set(n.name, n);
  }

  graph = { nodes, nodeByName, modules, types, countries: RELATION_COUNTRY_CODES, adjacency };

  post({
    type: 'LOAD_COMPLETE',
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      moduleCount: modules.length,
      typeCount: types.length,
    },
    nodes,
    modules,
    types,
    countries: RELATION_COUNTRY_CODES,
  });
}

function buildAllowedNodes(filters: Filters, g: GraphState): Set<string> | null {
  const {
    moduleExclude,
    countryExclude = [],
    allowedTypes,
    hideTempTables = true,
  } = filters;

  const hasFilters =
    moduleExclude.length > 0 ||
    countryExclude.length > 0 ||
    hideTempTables ||
    (allowedTypes.length > 0 && allowedTypes.length < g.types.length);
  if (!hasFilters) return null;

  const modExcludeSet = new Set(moduleExclude);
  const countryExcludeSet = new Set(countryExclude);
  const typeAllowSet = new Set(allowedTypes);
  const typesEmpty = allowedTypes.length === 0;

  const allowed = new Set<string>();
  for (const node of g.nodes) {
    if (isQueryNode(node)) continue;
    if (modExcludeSet.has(node.module)) continue;
    if (hideTempTables && isTempTableNode(node)) continue;
    if (isCountryScopedTable(node, countryExcludeSet)) continue;
    if (!typesEmpty && !typeAllowSet.has(node.type)) continue;
    allowed.add(node.name);
  }
  return allowed;
}

function cardinalitySummary(steps: PathStep[]): string {
  return steps
    .map((s) => {
      const left = s.reversed ? s.edge.target_cardinality : s.edge.cardinality;
      const right = s.reversed ? s.edge.cardinality : s.edge.target_cardinality;
      return `${left || '?'}→${right || '?'}`;
    })
    .join(' · ');
}

function cardinalityWeight(card: string): number {
  switch (card) {
    case 'ExactlyOne':
      return 1;
    case 'ZeroOne':
      return 2;
    case 'OneMore':
      return 3;
    case 'ZeroMore':
      return 4;
    default:
      return 5;
  }
}

function pathWeight(steps: PathStep[]): number {
  let w = 0;
  for (const s of steps) {
    w += cardinalityWeight(s.edge.cardinality);
    w += cardinalityWeight(s.edge.target_cardinality);
  }
  return w;
}

function groupPaths(paths: Path[]): GroupedPath[] {
  const groups = new Map<string, GroupedPath>();

  for (const path of paths) {
    const key = path.nodes.join('\u0001');
    const existing = groups.get(key);
    if (existing) {
      existing.variants.push(path);
      existing.variantCount += 1;
    } else {
      groups.set(key, {
        hops: path.hops,
        nodes: path.nodes,
        variants: [path],
        variantCount: 1,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.hops !== b.hops) return a.hops - b.hops;
    if (a.variantCount !== b.variantCount) return b.variantCount - a.variantCount;
    return a.nodes.join('|').localeCompare(b.nodes.join('|'));
  });
}

function searchPaths(
  g: GraphState,
  start: string,
  end: string,
  filters: Filters,
): Path[] {
  const allowedSet = new Set((filters.allowedConnections ?? []).filter((n) => n >= 1 && n <= 4));
  if (allowedSet.size === 0) {
    // Nothing enabled — treat as "2" default so the user isn't stuck with zero results.
    allowedSet.add(2);
  }
  const maxHops = Math.max(...Array.from(allowedSet));
  const allowedNodes = buildAllowedNodes(filters, g);
  const results: Path[] = [];

  const pathNodes: string[] = [start];
  const pathNodeSet = new Set<string>([start]);
  const pathSteps: PathStep[] = [];

  const seenSignatures = new Set<string>();

  const dfs = (current: string) => {
    if (current === end && pathSteps.length > 0) {
      if (!allowedSet.has(pathSteps.length)) {
        // Valid path but not one of the requested connection counts — skip emission.
        return;
      }
      // Signature = every step's from/to/join_expr so we dedupe parallel-edge duplicates from the reversed view.
      const sig = pathSteps.map((s) => `${s.from}>${s.to}|${s.edge.join_expr}`).join('#');
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        results.push({
          hops: pathSteps.length,
          nodes: pathNodes.slice(),
          steps: pathSteps.slice(),
          cardinalitySummary: cardinalitySummary(pathSteps),
        });
      }
      // Don't return — a simple path could reach end and still have alternatives? No, by the
      // simple-path rule and end being a node that would be marked visited, we can't keep going
      // through end. Return is correct.
      return;
    }
    if (pathSteps.length >= maxHops) return;

    const neighbors = g.adjacency.get(current);
    if (!neighbors) return;

    for (const entry of neighbors) {
      const next = entry.neighbor;
      if (pathNodeSet.has(next)) continue;
      if (next !== end && allowedNodes && !allowedNodes.has(next)) continue;

      pathNodes.push(next);
      pathNodeSet.add(next);
      pathSteps.push({
        edge: entry.edge,
        reversed: entry.reversed,
        from: current,
        to: next,
      });
      try {
        dfs(next);
      } finally {
        pathNodes.pop();
        pathNodeSet.delete(next);
        pathSteps.pop();
      }
    }
  };

  dfs(start);

  results.sort((a, b) => {
    if (a.hops !== b.hops) return a.hops - b.hops;
    return pathWeight(a.steps) - pathWeight(b.steps);
  });

  return results;
}

self.onmessage = async (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  try {
    if (msg.type === 'LOAD') {
      if (graph) {
        post({
          type: 'LOAD_COMPLETE',
          stats: {
            nodeCount: graph.nodes.length,
            edgeCount: Array.from(graph.adjacency.values()).reduce((a, b) => a + b.length, 0) / 2,
            moduleCount: graph.modules.length,
            typeCount: graph.types.length,
          },
          nodes: graph.nodes,
          modules: graph.modules,
          types: graph.types,
          countries: graph.countries,
        });
        return;
      }
      await loadGraph();
      return;
    }
    if (msg.type === 'SEARCH') {
      if (!graph) {
        post({ type: 'ERROR', message: 'Graph not loaded yet' });
        return;
      }
      const t0 = performance.now();
      const paths = searchPaths(graph, msg.start, msg.end, msg.filters);
      const groupedPaths = groupPaths(paths);
      const durationMs = Math.round(performance.now() - t0);
      post({ type: 'RESULTS', paths: groupedPaths, durationMs });
      return;
    }
  } catch (e) {
    post({ type: 'ERROR', message: e instanceof Error ? e.message : String(e) });
  }
};

export {};
