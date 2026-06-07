import type { GraphNode } from './worker/graphTypes';

export const RELATION_COUNTRY_CODES = [
  'AU', 'BE', 'BR', 'CA', 'CH', 'CL', 'CN', 'CZ', 'DE', 'EE',
  'ES', 'FI', 'FR', 'HU', 'IN', 'IT', 'JP', 'LV', 'MX', 'MY',
  'NA', 'NL', 'NO', 'PL', 'PSN', 'RU', 'RUX', 'SA', 'SE', 'TH',
  'UK', 'US', 'W', 'WCDR',
];

const COUNTRY_CODE_SET = new Set(RELATION_COUNTRY_CODES);

export function getRelationCountryCode(name: string): string | null {
  const match = name.match(/_([A-Z0-9]{1,4})$/);
  if (!match) return null;
  return COUNTRY_CODE_SET.has(match[1]) ? match[1] : null;
}

export function isCountryScopedTable(node: GraphNode, excludedCountries: Set<string>): boolean {
  if (node.type !== 'AxTable') return false;
  const countryCode = getRelationCountryCode(node.name);
  return !!countryCode && excludedCountries.has(countryCode);
}

export function isTempTableName(name: string): boolean {
  return /(?:Tmp|TMP|Temp(?=$|[A-Z0-9_]))/.test(name);
}

export function isTempTableNode(node: GraphNode): boolean {
  return node.type === 'AxTable' && isTempTableName(node.name);
}

export function isQueryNode(node: GraphNode): boolean {
  return node.type === 'AxQuery';
}
