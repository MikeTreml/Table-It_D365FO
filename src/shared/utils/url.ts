/**
 * URL utility functions
 */

/**
 * Validate if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure URL has protocol
 */
export function ensureProtocol(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Remove protocol from URL
 */
export function removeProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '');
}

export function normalizeBaseUrl(url: string): string {
  return removeProtocol(url).trim().replace(/\/+$/, '');
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(ensureProtocol(url));
    return urlObj.hostname;
  } catch {
    return url;
  }
}

/**
 * Build query string from object
 */
export function buildQueryString(params: Record<string, string | number | boolean>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function buildTableBrowserUrl(
  baseUrl: string,
  tableName: string,
  companyId: string,
  languageId: string,
  limitedNav: boolean,
): string {
  const url = new URL(`https://${normalizeBaseUrl(baseUrl)}/`);
  url.searchParams.set('mi', 'SysTableBrowser');
  url.searchParams.set('TableName', tableName);
  url.searchParams.set('cmp', companyId);
  url.searchParams.set('limitednav', String(limitedNav));
  url.searchParams.set('lng', languageId);
  return url.toString();
}

export function buildEnvironmentUrl(baseUrl: string): string {
  return `https://${normalizeBaseUrl(baseUrl)}/`;
}

export function withExtensionProfile(url: string, profileId?: string | null): string {
  if (!profileId) return url;
  const nextUrl = new URL(url);
  nextUrl.searchParams.set('profileId', profileId);
  return nextUrl.toString();
}

export type EntityDataUrlParams = {
  filter?: string;
  select?: string;
  orderby?: string;
  top?: string | number;
  skip?: string | number;
  count?: boolean;
  crossCompany?: boolean;
};

export function buildEntityDataUrl(
  baseUrl: string,
  collectionName: string,
  params: EntityDataUrlParams = {},
): string {
  const url = new URL(`https://${normalizeBaseUrl(baseUrl)}/data/${encodeURIComponent(collectionName)}`);
  if (params.top !== undefined && params.top !== '') url.searchParams.set('$top', String(params.top));
  if (params.filter) url.searchParams.set('$filter', params.filter);
  if (params.select) url.searchParams.set('$select', params.select);
  if (params.orderby) url.searchParams.set('$orderby', params.orderby);
  if (params.skip !== undefined && params.skip !== '') url.searchParams.set('$skip', String(params.skip));
  if (params.count) url.searchParams.set('$count', 'true');
  if (params.crossCompany) url.searchParams.set('cross-company', 'true');
  return url.toString();
}

/**
 * Parse query string to object
 */
export function parseQueryString(queryString: string): Record<string, string> {
  const params = new URLSearchParams(queryString.startsWith('?') ? queryString.slice(1) : queryString);
  const result: Record<string, string> = {};

  params.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}
