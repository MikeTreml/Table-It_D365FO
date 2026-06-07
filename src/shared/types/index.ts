// ─── Profile ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  name: string;
  baseUrl: string;      // e.g. contoso.operations.dynamics.com
  companyId: string;    // e.g. USMF
  languageId: string;   // e.g. en-us
  limitedNav: boolean;
  isDefault: boolean;
  color: string;
  colorPresetId?: string;   // links to a COLOR_PRESETS id (e.g. 'forest')
  themeMode?: Theme;        // 'light' | 'dark' | 'auto' — null = use global
  createdAt: number;
  updatedAt: number;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark' | 'auto';

// ─── Color Theme ──────────────────────────────────────────────────────────────

export interface ColorSeeds {
  /** Primary action color — buttons, links, active states (mid-point of brand scale) */
  primaryAction: string;
  /** Secondary highlight — badges, entity button, accents */
  highlight: string;
  /** Page background */
  pageBg: string;
  /** Toolbar / header background */
  toolbar: string;
  /** Primary body text */
  bodyText: string;
}

export interface ColorSeedsDark {
  /** Dark mode page background */
  pageBg: string;
  /** Dark mode card / panel background */
  panelBg: string;
  /** Dark mode toolbar background */
  toolbar: string;
  /** Dark mode primary text */
  bodyText: string;
}

export interface ColorTheme {
  /** 'forest' | 'ocean' | 'slate' | 'rose' | 'dusk' | 'midnight' | 'custom' */
  presetId: string;
  light: ColorSeeds;
  dark: ColorSeedsDark;
}

export interface AppSettings {
  theme: Theme;
  colorTheme: ColorTheme;
  colorPresets?: Record<string, ColorTheme>;
  highContrastBw?: boolean;
}

// ─── Storage Schema ───────────────────────────────────────────────────────────

export interface StorageSchema {
  profiles: Profile[];
  activeProfileId: string | null;
  settings: AppSettings;
  favorites: string[];   // table names
  entityCountCache: Record<string, EntityCountCacheEntry>;
  metadataCache: Record<string, MetadataCacheEntry>;
}

// ─── Table ───────────────────────────────────────────────────────────────────

export interface TableDefinition {
  name: string;
  label: string;
  group: string;
  type: string;
  appModule: string;
  formReference: string;
  sysTable: boolean;
  view: boolean;
  global: boolean;
}

// ─── Data Entity ─────────────────────────────────────────────────────────────

// Raw response from /metadata/DataEntities
export interface DataEntityRaw {
  Name: string;
  PublicEntityName: string | null;
  PublicCollectionName: string | null;
  LabelId: string | null;
  DataServiceEnabled: boolean;
  DataManagementEnabled: boolean;
  EntityCategory: string | null;
  IsReadOnly: boolean;
}

// Raw response from /data/DataManagementEntities
export interface DataManagementEntityRaw {
  TargetName: string;
  EntityName: string;
  Modules: string;
  IsShared: string;
  StagingTableName: string;
  EntityKey: string;
  ChangeTrackingType: string;
  EntityIsEnabled: string;
  Tags: string;
  CountryRegionCodes: string;
  ConfigurationKeyName: string;
  Category: string;
}

// Merged entity used in the UI
export interface DataEntity {
  // from /metadata/DataEntities
  Name: string;
  PublicCollectionName: string;
  PublicEntityName: string;
  LabelId: string;
  DataServiceEnabled: boolean;
  DataManagementEnabled: boolean;
  EntityCategory: string;
  IsReadOnly: boolean;
  // from /data/DataManagementEntities
  EntityName: string;
  Modules: string;
  IsShared: string;
  StagingTableName: string;
  EntityKey: string;
  ChangeTrackingType: string;
  EntityIsEnabled: string;
  Tags: string;
  CountryRegionCodes: string;
  ConfigurationKeyName: string;
}

export interface EntityField {
  Name: string;
  Label: string;
  LabelId: string;
  FieldType: string;
  TypeName: string;
  DataType: string;
  IsKey: boolean;
  IsMandatory: boolean;
  ConfigurationEnabled: boolean;
  AllowEdit: boolean;
  AllowEditOnCreate: boolean;
  IsComputedField: boolean;
  IsDimension: boolean;
  DimensionRelation: string;
  IsDynamicDimension: boolean;
  DimensionLegalEntityProperty: string;
  DimensionTypeProperty: string;
}

// ─── OData ───────────────────────────────────────────────────────────────────

export type ODataFilterOperator =
  | 'eq' | 'ne' | 'gt' | 'ge' | 'lt' | 'le'
  | 'contains' | 'startswith' | 'endswith';

export type ODataLogicalOp = 'and' | 'or';

export interface ODataFilter {
  id: string;
  field: string;
  operator: ODataFilterOperator;
  value: string;
  logicalOp: ODataLogicalOp;
}

export interface ODataQuery {
  entity: string;
  select: string[];
  filter: ODataFilter[];
  orderBy: { field: string; direction: 'asc' | 'desc' }[];
  top: number | null;
  skip: number | null;
  count: boolean;
  expand: string[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export interface ApiError {
  status: number;
  message: string;
  detail?: string;
}

export interface EntityCountCacheEntry {
  updatedAt: number;
  counts: Record<string, number>;
}

export interface MetadataCacheEntry {
  updatedAt: number;
  dataEntitiesJson?: string;
  publicEntitiesJson?: string;
  publicEntityFieldsJsonByCollection?: Record<string, string>;
  publicEnumerationsJson?: string;
  labelsJsonByLanguage?: Record<string, string>;
}
