/**
 * Main storage schema for the extension
 */
export interface StorageSchema {
  version: number;
  profiles: Profile[];
  selectedProfileId: string | null;
  settings: AppSettings;
  cache: CacheData;
  favorites: Favorite[];
  queryTemplates: QueryTemplate[];
}

/**
 * Profile represents a D365FO environment configuration
 */
export interface Profile {
  id: string; // UUID
  name: string; // User-friendly name
  baseUrl: string; // Without https://
  companyId: string; // e.g., "DAT"
  languageId: string; // e.g., "en-US"
  limitedNav: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
  color?: string; // Visual identifier
}

/**
 * Application settings
 */
export interface AppSettings {
  theme: 'light' | 'dark' | 'auto';
  highContrastBw?: boolean;
  useBuiltInTableList: boolean;
  customTableList?: {
    fileName: string;
    compressed: string;
    uploadedAt: number;
  };
  shortcuts: KeyboardShortcuts;
}

/**
 * Keyboard shortcuts configuration
 */
export interface KeyboardShortcuts {
  focusSearch?: string;
  openProfileSwitcher?: string;
  openTables?: string;
  openEntities?: string;
  openQueryBuilder?: string;
}

/**
 * Cache data structure
 */
export interface CacheData {
  dataEntities?: {
    data: string; // LZ-compressed JSON
    timestamp: number;
    profileId: string;
  };
  entityMetadata: Record<string, EntityMetadataCache>;
}

/**
 * Entity metadata cache
 */
export interface EntityMetadataCache {
  data: string; // LZ-compressed JSON
  timestamp: number;
  profileId: string;
}

/**
 * Favorite item (table or entity)
 */
export interface Favorite {
  id: string;
  type: 'table' | 'entity';
  name: string;
  label: string;
  addedAt: number;
  profileId?: string;
}

/**
 * Query template for OData queries
 */
export interface QueryTemplate {
  id: string;
  name: string;
  description?: string;
  entitySet: string;
  filters: ODataFilter[];
  select: string[];
  expand: string[];
  orderBy: string[];
  top?: number;
  skip?: number;
  createdAt: number;
  tags: string[];
}

/**
 * OData filter definition
 */
export interface ODataFilter {
  id: string;
  field: string;
  operator: ODataOperator;
  value: string | number | boolean;
  logicalOperator?: 'and' | 'or';
  group?: ODataFilter[]; // For nested groups
}

/**
 * OData operators
 */
export type ODataOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'ge'
  | 'lt'
  | 'le'
  | 'contains'
  | 'startswith'
  | 'endswith'
  | 'in'
  | 'not in';

/**
 * Legacy storage keys (for migration)
 */
export interface LegacyStorage {
  AXbaseURLs?: string[];
  selectedAXbaseURL?: string;
  CompanyId?: string;
  selectLanguageId?: string;
  limitedNav?: string;
  lastQuery?: string;
  tableList?: [string, number, number, string]; // [filename, size, timestamp, compressed_data]
  useOwnTableList?: boolean;
  DataEntities?: unknown;
}
