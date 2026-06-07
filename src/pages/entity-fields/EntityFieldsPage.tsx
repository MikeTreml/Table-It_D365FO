import React, { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Columns, LogIn, RefreshCw, X } from 'lucide-react';
import {
  BrowserToolbar,
  BrowserToolbarIdentity,
  BrowserToolbarProfile,
} from '@shared/components/BrowserToolbarIdentity';
import { DataGrid } from '@shared/components/DataGrid';
import { BoolCell, NO_ENTRY } from '@shared/components/GridCells';
import { SearchInput } from '@shared/components/SearchInput';
import { useAppTheme } from '@shared/hooks/useAppTheme';
import { useUrlProfile } from '@shared/hooks/useUrlProfile';
import { useProfileStore } from '@shared/stores/profileStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { D365ApiClient } from '@shared/services/D365ApiClient';
import { buildEnvironmentUrl } from '@shared/utils/url';
import type { ApiError, EntityField } from '@shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STANDARD_TYPES = new Set([
  'String', 'Int32', 'Int64', 'Real', 'DateTime', 'UtcDateTime',
  'Date', 'Time', 'Guid', 'Container', 'Class', 'Blob', 'Binary',
  'Boolean', 'Decimal', 'Double', 'Float',
  'Edm.String', 'Edm.Int32', 'Edm.Int64', 'Edm.Decimal', 'Edm.Boolean',
  'Edm.DateTimeOffset', 'Edm.Guid', 'Edm.Double',
]);

const isAxTypeAnnotation = (fieldType: string) =>
  fieldType.startsWith('Microsoft.Dynamics.OData.Core.V1.AXType/');
const isEnum = (fieldType: string) =>
  !!fieldType && !STANDARD_TYPES.has(fieldType) && !isAxTypeAnnotation(fieldType);
const getEnumType = (field: EntityField | null | undefined): string | null => {
  if (!field) return null;

  const candidates = [field.FieldType, field.TypeName, field.DataType];
  for (const candidate of candidates) {
    if (candidate && isEnum(candidate)) return candidate;
  }

  return null;
};
const getEnumMembers = (
  enumMap: Map<string, Array<{ name: string; value: number }>> | undefined,
  enumType: string | null,
): Array<{ name: string; value: number }> | null => {
  if (!enumMap || !enumType) return null;

  const shortName = enumType.split('.').pop() ?? enumType;
  return enumMap.get(enumType) ?? enumMap.get(shortName) ?? null;
};
const getShortTypeName = (typeName: string) => typeName.split('.').pop() ?? typeName;
const getDisplayType = (field: EntityField): string => {
  const enumType = getEnumType(field);
  return enumType ? getShortTypeName(enumType) : field.FieldType;
};

const FIELD_TOOLBAR_ACTION_CLS = [
  'flex items-center gap-1.5 px-3 py-1.5',
  'text-xs font-medium rounded-lg shrink-0',
  'bg-brand-600 border border-brand-900 text-surface-50',
  'hover:bg-brand-700',
  'dark:bg-surface-800 dark:border-surface-700 dark:text-surface-100 dark:hover:bg-surface-900',
  'disabled:opacity-40 transition-colors',
].join(' ');


function TypeCell({ field }: { field: EntityField }) {
  const value = getDisplayType(field);
  const fullType = getEnumType(field) ?? field.FieldType;

  return isEnum(fullType)
    ? <span className="text-sm font-medium text-accent-600 dark:text-accent-400" title={fullType}>{value}</span>
    : <span className="text-sm">{value || NO_ENTRY}</span>;
}

// ─── Enum side panel ──────────────────────────────────────────────────────────

function EnumPanel({
  field,
  members,
  loading,
  onClose,
}: {
  field: EntityField;
  members: Array<{ name: string; value: number }> | null;
  loading: boolean;
  onClose: () => void;
}) {
  const sortedMembers = useMemo(
    () => members ? [...members].sort((a, b) => a.value - b.value) : null,
    [members],
  );

  return (
    <div className="w-72 shrink-0 flex flex-col border-l border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-surface-100 dark:border-surface-800 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-surface-800 dark:text-surface-200 truncate">
            {field.Label || field.Name}
          </div>
          <div className="text-xs font-medium text-accent-600 dark:text-accent-400 truncate">
            {getDisplayType(field)}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 rounded text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !sortedMembers || sortedMembers.length === 0 ? (
          <p className="text-xs text-center text-surface-400 dark:text-surface-500 py-8">
            No enum values found
          </p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 bg-surface-100 dark:bg-surface-800">
              <tr>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-100 border-b border-surface-200 dark:border-surface-700 w-14">
                  Value
                </th>
                <th className="px-3 py-1.5 text-left text-xs font-semibold text-surface-500 dark:text-surface-100 border-b border-surface-200 dark:border-surface-700">
                  Name
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((m, i) => (
                <tr
                  key={m.name}
                  className={[
                    'border-b border-surface-100 dark:border-surface-800/80',
                    i % 2 === 0
                      ? 'bg-white dark:bg-surface-900'
                      : 'bg-surface-50/70 dark:bg-surface-850/60',
                  ].join(' ')}
                >
                  <td className="px-3 py-1.5 text-surface-400 dark:text-surface-500 tabular-nums text-xs">
                    {m.value}
                  </td>
                  <td className="px-3 py-1.5 text-surface-800 dark:text-surface-200">
                    {m.name}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-3 py-1.5 text-xs text-surface-400 dark:text-surface-500 border-t border-surface-200 dark:border-surface-700 shrink-0">
        {sortedMembers ? `${sortedMembers.length} values` : ''}
      </div>
    </div>
  );
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const columnHelper = createColumnHelper<EntityField>();

const columns = [
  columnHelper.accessor('Name', {
    header: 'Field Name',
    size: 260,
  }),
  columnHelper.accessor('Label', {
    header: 'Label',
    size: 220,
    cell: (info) => info.getValue() || NO_ENTRY,
  }),
  columnHelper.accessor('LabelId', {
    header: 'Label ID',
    size: 180,
    cell: (info) => info.getValue() || NO_ENTRY,
  }),
  columnHelper.accessor('FieldType', {
    header: 'Type',
    size: 180,
    filterFn: 'multiSelectFilter',
    meta: { filterType: 'multiselect' },
    cell: (info) => <TypeCell field={info.row.original} />,
  }),
  columnHelper.accessor('TypeName', {
    header: 'Type Name',
    size: 180,
    filterFn: 'multiSelectFilter',
    meta: { filterType: 'multiselect' },
    cell: (info) => info.getValue() || NO_ENTRY,
  }),
  columnHelper.accessor('DataType', {
    header: 'Data Type',
    size: 130,
    filterFn: 'multiSelectFilter',
    meta: { filterType: 'multiselect' },
    cell: (info) => info.getValue() || NO_ENTRY,
  }),
  columnHelper.accessor('IsKey', {
    header: 'Key',
    size: 90,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: (info) => <BoolCell value={info.getValue()} size="sm" />,
  }),
  columnHelper.accessor('IsMandatory', {
    header: 'Required',
    size: 120,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: (info) => <BoolCell value={info.getValue()} size="sm" />,
  }),
  columnHelper.accessor('ConfigurationEnabled', {
    header: 'Config',
    size: 108,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: (info) => <BoolCell value={info.getValue()} size="sm" />,
  }),
  columnHelper.accessor('AllowEdit', {
    header: 'Editable',
    size: 120,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: (info) => <BoolCell value={info.getValue()} size="sm" />,
  }),
  columnHelper.accessor('AllowEditOnCreate', {
    header: 'On Create',
    size: 126,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: (info) => <BoolCell value={info.getValue()} size="sm" />,
  }),
  columnHelper.accessor('IsComputedField', {
    header: 'Computed',
    size: 120,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: (info) => <BoolCell value={!!info.getValue()} size="sm" />,
  }),
  columnHelper.accessor('IsDimension', {
    header: 'Dimension',
    size: 126,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: (info) => <BoolCell value={info.getValue()} size="sm" />,
  }),
  columnHelper.accessor('IsDynamicDimension', {
    header: 'Dynamic Dim',
    size: 138,
    filterFn: 'booleanFilter',
    meta: { filterType: 'boolean' },
    cell: (info) => <BoolCell value={info.getValue()} size="sm" />,
  }),
  columnHelper.accessor('DimensionRelation', {
    header: 'Dim Relation',
    size: 180,
    cell: (info) => info.getValue() || NO_ENTRY,
  }),
  columnHelper.accessor('DimensionLegalEntityProperty', {
    header: 'Dim Legal Entity',
    size: 180,
    cell: (info) => info.getValue() || NO_ENTRY,
  }),
  columnHelper.accessor('DimensionTypeProperty', {
    header: 'Dim Type Prop',
    size: 180,
    cell: (info) => info.getValue() || NO_ENTRY,
  }),
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function EntityFieldsPage() {
  const params = new URLSearchParams(window.location.search);
  const collection = params.get('collection') ?? '';
  const entityName = params.get('entity') ?? '';

  const [search, setSearch] = useState('');
  const [enumsOnly, setEnumsOnly] = useState(false);
  const [selectedField, setSelectedField] = useState<EntityField | null>(null);
  const [metadataRefreshToken, setMetadataRefreshToken] = useState(0);

  const loadSettings = useSettingsStore((s) => s.load);
  const loadProfiles = useProfileStore((s) => s.load);
  const profilesLoaded = useProfileStore((s) => s.loaded);
  const activeProfile = useUrlProfile();

  useAppTheme(activeProfile);

  useEffect(() => {
    loadSettings();
    loadProfiles();
  }, [loadSettings, loadProfiles]);

  const client = useMemo(
    () => profilesLoaded && activeProfile ? new D365ApiClient(activeProfile.baseUrl) : null,
    [profilesLoaded, activeProfile],
  );

  const {
    data: fields = [],
    isLoading: fieldsLoading,
    error: fieldsError,
  } = useQuery({
    queryKey: ['entityFields', collection, activeProfile?.baseUrl, activeProfile?.languageId, metadataRefreshToken],
    queryFn: () => client!.fetchEntityFields(collection, activeProfile?.languageId, metadataRefreshToken > 0),
    enabled: !!client && !!collection,
    staleTime: 10 * 60 * 1000,
  });

  const selectedEnumType = getEnumType(selectedField);

  const {
    data: enumMap,
    isLoading: enumLoading,
  } = useQuery({
    queryKey: ['metadataEnums', activeProfile?.baseUrl, metadataRefreshToken],
    queryFn: () => client!.fetchMetadataEnums(metadataRefreshToken > 0),
    enabled: !!client && !!selectedEnumType,
    staleTime: 60 * 60 * 1000,
  });

  const enumMembers = getEnumMembers(enumMap, selectedEnumType);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return fields.filter((f) => {
      if (enumsOnly && !getEnumType(f)) return false;
      if (!q) return true;
      return (
        f.Name.toLowerCase().includes(q) ||
        f.Label.toLowerCase().includes(q) ||
        f.LabelId.toLowerCase().includes(q) ||
        f.FieldType.toLowerCase().includes(q) ||
        f.TypeName.toLowerCase().includes(q) ||
        f.DataType.toLowerCase().includes(q) ||
        f.DimensionRelation.toLowerCase().includes(q) ||
        f.DimensionLegalEntityProperty.toLowerCase().includes(q) ||
        f.DimensionTypeProperty.toLowerCase().includes(q)
      );
    });
  }, [fields, search, enumsOnly]);

  const signIn = () => {
    if (!activeProfile) return;
    chrome.tabs.create({ url: buildEnvironmentUrl(activeProfile.baseUrl) });
  };

  const handleRowSelect = (field: EntityField | null) => {
    if (field && getEnumType(field)) {
      setSelectedField((prev) => (prev?.Name === field.Name ? null : field));
    } else {
      setSelectedField(null);
    }
  };

  const enumCount = useMemo(() => fields.filter((f) => !!getEnumType(f)).length, [fields]);
  const fieldsApiError = fieldsError as ApiError | null;
  const fieldsNeedsSignIn = fieldsApiError?.status === 401;
  const fieldsErrorMessage = fieldsNeedsSignIn
    ? 'Your D365FO session is inactive. Sign in to the environment, then retry loading fields.'
    : (fieldsApiError?.message ?? 'Failed to load fields.');

  const refreshFields = () => {
    setMetadataRefreshToken((value) => value + 1);
  };
  const title = `${entityName || collection || 'Entity'} Fields`;

  return (
    <div className="flex flex-col h-screen bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-100">
      {/* Toolbar */}
      <BrowserToolbar>
        <BrowserToolbarIdentity
          icon={<Columns className="w-6 h-6" />}
          title={title}
        />

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search fields..."
          className="flex-[1_1_50ch] min-w-0 max-w-[50ch]"
          autoFocus
        />
        <div className="flex-1 min-w-0" />

        {enumCount > 0 && (
          <button
            onClick={() => setEnumsOnly((v) => !v)}
            className={FIELD_TOOLBAR_ACTION_CLS}
            title="Show only enum / picklist fields"
          >
            Enums ({enumCount})
          </button>
        )}

        <BrowserToolbarProfile profile={activeProfile} />

        <button
          onClick={refreshFields}
          disabled={fieldsLoading || enumLoading}
          className={FIELD_TOOLBAR_ACTION_CLS}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${fieldsLoading || enumLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </BrowserToolbar>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Grid */}
        <div className="flex-1 overflow-hidden">
          {fieldsError ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-surface-500 dark:text-surface-400 p-8">
              <p className="text-sm text-center">
                {fieldsErrorMessage}
              </p>
              {fieldsApiError?.detail && !fieldsNeedsSignIn && (
                <code className="text-xs text-surface-400 dark:text-surface-500 break-all text-center">
                  {fieldsApiError.detail}
                </code>
              )}
              <div className="flex items-center gap-2">
                {fieldsNeedsSignIn && activeProfile && (
                  <button
                    onClick={signIn}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Sign in to D365FO
                  </button>
                )}
                <button
                  onClick={refreshFields}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            </div>
          ) : (
            <DataGrid
              data={filtered}
              columns={columns}
              globalFilter={search}
              rowKey={(f) => f.Name}
              loading={fieldsLoading}
              loadingMessage="Loading entity fields..."
              emptyMessage="No fields match your search."
              onRowSelect={handleRowSelect}
              selectedRow={selectedField}
              rowClassName={(f) => getEnumType(f) ? 'cursor-pointer' : ''}
            />
          )}
        </div>

        {/* Enum side panel */}
        {selectedField && getEnumType(selectedField) && (
          <EnumPanel
            field={selectedField}
            members={enumMembers}
            loading={enumLoading}
            onClose={() => setSelectedField(null)}
          />
        )}
      </div>
    </div>
  );
}
