import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';
import type {
  DataEntity,
  DataEntityRaw,
  DataManagementEntityRaw,
  EntityField,
  ApiError,
  MetadataCacheEntry,
} from '../types';
import { storageService } from './StorageService';
import { normalizeBaseUrl } from '@shared/utils/url';

function getMetadataCacheKey(baseUrl: string): string {
  return normalizeBaseUrl(baseUrl).toLowerCase();
}

function encodeCacheValue<T>(value: T): string {
  return compressToUTF16(JSON.stringify(value));
}

function decodeCacheValue<T>(value?: string): T | null {
  if (!value) return null;

  try {
    const json = decompressFromUTF16(value);
    return json ? JSON.parse(json) as T : null;
  } catch {
    return null;
  }
}

function extractCollection<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'value' in payload &&
    Array.isArray((payload as { value?: unknown }).value)
  ) {
    return (payload as { value: T[] }).value;
  }

  return [];
}

function normalizeLanguageId(languageId: string): string {
  const [language, region, ...rest] = languageId.split('-');
  if (!language) return languageId;
  const normalized = [language.toLowerCase()];
  if (region) normalized.push(region.toUpperCase());
  if (rest.length > 0) normalized.push(...rest);
  return normalized.join('-');
}

function escapeODataKey(value: string): string {
  return value.replace(/'/g, "''");
}

function extractLabelText(payload: unknown): string | null {
  if (!payload) return null;

  if (typeof payload === 'string') {
    return payload.trim() || null;
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const text = extractLabelText(item);
      if (text) return text;
    }
    return null;
  }

  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['Text', 'Value', 'Label', 'Description', 'TranslatedText']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    if ('value' in record) {
      return extractLabelText(record.value);
    }
  }

  return null;
}

interface PublicEntityMetadataRaw {
  EntitySetName?: string;
  Properties?: EntityFieldRaw[];
}

interface EntityFieldRaw {
  Name?: string;
  Label?: string;
  LabelId?: string;
  FieldType?: string;
  TypeName?: string;
  DataType?: string;
  IsKey?: boolean;
  IsMandatory?: boolean;
  ConfigurationEnabled?: boolean;
  AllowEdit?: boolean;
  AllowEditOnCreate?: boolean;
  IsComputedField?: boolean;
  IsDimension?: boolean;
  DimensionRelation?: string | null;
  IsDynamicDimension?: boolean;
  DimensionLegalEntityProperty?: string | null;
  DimensionTypeProperty?: string | null;
}

interface PublicEnumerationMemberRaw {
  Name?: string;
  Value?: number | string;
}

interface PublicEnumerationRaw {
  Name?: string;
  Members?: PublicEnumerationMemberRaw[];
}

function isStandardFieldType(typeName?: string): boolean {
  if (typeName?.startsWith('Microsoft.Dynamics.OData.Core.V1.AXType/')) {
    return true;
  }

  return [
    'String', 'Int32', 'Int64', 'Real', 'DateTime', 'UtcDateTime',
    'Date', 'Time', 'Guid', 'Container', 'Class', 'Blob', 'Binary',
    'Boolean', 'Decimal', 'Double', 'Float',
    'Edm.String', 'Edm.Int32', 'Edm.Int64', 'Edm.Decimal', 'Edm.Boolean',
    'Edm.DateTimeOffset', 'Edm.Guid', 'Edm.Double',
  ].includes(typeName ?? '');
}

function handleApiError(error: AxiosError): ApiError {
  if (error.response) {
    const status = error.response.status;
    const messages: Record<number, string> = {
      401: 'Unauthorized — check that you are signed in to D365FO.',
      403: 'Forbidden — you do not have access to this resource.',
      404: 'Not found — the endpoint does not exist.',
      429: 'Too many requests — please wait before retrying.',
    };
    return {
      status,
      message: messages[status] ?? `Server error (${status})`,
      detail: (error.config?.baseURL ?? '') + (error.config?.url ?? ''),
    };
  }
  if (error.request) {
    return {
      status: 0,
      message: 'No response from server — check your network connection.',
      detail: (error.config?.baseURL ?? '') + (error.config?.url ?? ''),
    };
  }
  return { status: -1, message: error.message };
}

export class D365ApiClient {
  private client: AxiosInstance;
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.client = axios.create({
      baseURL: `https://${this.baseUrl}`,
      headers: { Accept: 'application/json' },
      withCredentials: true,
    });
  }

  get entitiesUrl(): string {
    return `https://${this.baseUrl}/metadata/DataEntities`;
  }

  private async getMetadataCacheEntry(): Promise<MetadataCacheEntry | null> {
    const cache = await storageService.getMetadataCache();
    return cache[getMetadataCacheKey(this.baseUrl)] ?? null;
  }

  private async saveMetadataCachePatch(patch: Partial<MetadataCacheEntry>): Promise<void> {
    const cache = await storageService.getMetadataCache();
    const cacheKey = getMetadataCacheKey(this.baseUrl);
    const existing = cache[cacheKey] ?? { updatedAt: Date.now() };

    await storageService.set('metadataCache', {
      ...cache,
      [cacheKey]: {
        ...existing,
        ...patch,
        updatedAt: Date.now(),
      },
    });
  }

  private async getCachedDataEntities(): Promise<DataEntity[] | null> {
    const entry = await this.getMetadataCacheEntry();
    return decodeCacheValue<DataEntity[]>(entry?.dataEntitiesJson);
  }

  private async getCachedPublicEntities(): Promise<PublicEntityMetadataRaw[] | null> {
    const entry = await this.getMetadataCacheEntry();
    return decodeCacheValue<PublicEntityMetadataRaw[]>(entry?.publicEntitiesJson);
  }

  private async getCachedEntityFields(publicCollectionName: string): Promise<EntityField[] | null> {
    const entry = await this.getMetadataCacheEntry();
    const cacheKey = publicCollectionName.toLowerCase();
    return decodeCacheValue<EntityField[]>(entry?.publicEntityFieldsJsonByCollection?.[cacheKey]);
  }

  private async saveCachedEntityFields(publicCollectionName: string, fields: EntityField[]): Promise<void> {
    const entry = await this.getMetadataCacheEntry();
    const cacheKey = publicCollectionName.toLowerCase();

    await this.saveMetadataCachePatch({
      publicEntityFieldsJsonByCollection: {
        ...(entry?.publicEntityFieldsJsonByCollection ?? {}),
        [cacheKey]: encodeCacheValue(fields),
      },
    });
  }

  private async getCachedPublicEnumerations(): Promise<PublicEnumerationRaw[] | null> {
    const entry = await this.getMetadataCacheEntry();
    return decodeCacheValue<PublicEnumerationRaw[]>(entry?.publicEnumerationsJson);
  }

  private async getCachedLabels(languageId: string): Promise<Record<string, string>> {
    const entry = await this.getMetadataCacheEntry();
    const normalizedLanguageId = normalizeLanguageId(languageId);
    const encoded = entry?.labelsJsonByLanguage?.[normalizedLanguageId];
    return decodeCacheValue<Record<string, string>>(encoded) ?? {};
  }

  private async saveCachedLabels(languageId: string, labels: Record<string, string>): Promise<void> {
    const cache = await this.getMetadataCacheEntry();
    const normalizedLanguageId = normalizeLanguageId(languageId);

    await this.saveMetadataCachePatch({
      labelsJsonByLanguage: {
        ...(cache?.labelsJsonByLanguage ?? {}),
        [normalizedLanguageId]: encodeCacheValue(labels),
      },
    });
  }

  private async fetchDataManagementMap(): Promise<Map<string, DataManagementEntityRaw>> {
    const dmfMap = new Map<string, DataManagementEntityRaw>();

    try {
      const res = await this.client.get<{ value: DataManagementEntityRaw[] }>('/data/DataManagementEntities');
      for (const item of res.data.value) {
        dmfMap.set(item.TargetName.toUpperCase(), item);
      }
    } catch {
      // Non-fatal — continue without DMF enrichment
    }

    return dmfMap;
  }

  private mapEntities(base: DataEntityRaw[], dmfMap: Map<string, DataManagementEntityRaw>): DataEntity[] {
    return base.map((e) => {
      const dmf = dmfMap.get(e.Name.toUpperCase());
      return {
        Name: e.Name,
        PublicCollectionName: e.PublicCollectionName ?? '',
        PublicEntityName: e.PublicEntityName ?? '',
        LabelId: e.LabelId ?? '',
        DataServiceEnabled: e.DataServiceEnabled,
        DataManagementEnabled: e.DataManagementEnabled,
        EntityCategory: e.EntityCategory ?? '',
        IsReadOnly: e.IsReadOnly,
        EntityName: dmf?.EntityName ?? '',
        Modules: dmf?.Modules ?? '',
        IsShared: dmf?.IsShared ?? '',
        StagingTableName: dmf?.StagingTableName ?? '',
        EntityKey: dmf?.EntityKey ?? '',
        ChangeTrackingType: dmf?.ChangeTrackingType ?? '',
        EntityIsEnabled: dmf?.EntityIsEnabled ?? '',
        Tags: dmf?.Tags ?? '',
        CountryRegionCodes: dmf?.CountryRegionCodes ?? '',
        ConfigurationKeyName: dmf?.ConfigurationKeyName ?? '',
      };
    });
  }

  private sortEntityFields(fields: EntityField[]): EntityField[] {
    return fields.slice().sort((a, b) => a.Name.localeCompare(b.Name));
  }

  private normalizeEntityField(field: EntityFieldRaw): EntityField {
    const typeName = field.TypeName ?? '';
    const dataType = field.DataType ?? '';
    const fieldType = field.FieldType ?? '';
    const preferredType = typeName && !isStandardFieldType(typeName)
      ? typeName
      : fieldType || dataType || typeName;

    return {
      Name: field.Name ?? '',
      Label: field.Label ?? '',
      LabelId: field.LabelId ?? '',
      FieldType: preferredType,
      TypeName: typeName,
      DataType: dataType,
      IsKey: field.IsKey ?? false,
      IsMandatory: field.IsMandatory ?? false,
      ConfigurationEnabled: field.ConfigurationEnabled ?? false,
      AllowEdit: field.AllowEdit ?? false,
      AllowEditOnCreate: field.AllowEditOnCreate ?? false,
      IsComputedField: field.IsComputedField ?? false,
      IsDimension: field.IsDimension ?? false,
      DimensionRelation: field.DimensionRelation ?? '',
      IsDynamicDimension: field.IsDynamicDimension ?? false,
      DimensionLegalEntityProperty: field.DimensionLegalEntityProperty ?? '',
      DimensionTypeProperty: field.DimensionTypeProperty ?? '',
    };
  }

  private async resolveEntityFieldLabels(fields: EntityField[], languageId?: string, forceRefresh = false): Promise<EntityField[]> {
    if (!languageId) {
      return fields.map((field) => ({
        ...field,
        Label: field.Label || field.LabelId,
      }));
    }

    const labelIds = [...new Set(
      fields
        .map((field) => field.LabelId)
        .filter((labelId) => !!labelId),
    )];

    if (labelIds.length === 0) {
      return fields.map((field) => ({
        ...field,
        Label: field.Label || field.LabelId,
      }));
    }

    const cachedLabels = forceRefresh ? {} : await this.getCachedLabels(languageId);
    const resolvedLabels = { ...cachedLabels };
    const missingLabelIds = labelIds.filter((labelId) => !(labelId in resolvedLabels));
    const normalizedLanguageId = normalizeLanguageId(languageId);

    for (const labelId of missingLabelIds) {
      try {
        const endpoint = `/metadata/Labels(Id='${escapeODataKey(labelId)}',Language='${escapeODataKey(normalizedLanguageId)}')`;
        const response = await this.client.get<unknown>(endpoint);
        const text = extractLabelText(response.data);
        if (text) {
          resolvedLabels[labelId] = text;
        }
      } catch {
        // Non-fatal; keep the label id as the visible fallback.
      }
    }

    if (Object.keys(resolvedLabels).length !== Object.keys(cachedLabels).length) {
      await this.saveCachedLabels(languageId, resolvedLabels);
    }

    return fields.map((field) => ({
      ...field,
      Label: resolvedLabels[field.LabelId] ?? field.Label ?? field.LabelId,
    }));
  }

  private getEntityFieldsFromPublicEntities(
    publicEntities: PublicEntityMetadataRaw[],
    publicCollectionName: string,
  ): EntityField[] {
    const props = publicEntities.find(
      (entity) => entity.EntitySetName === publicCollectionName,
    )?.Properties ?? [];

    return this.sortEntityFields(props.map((field) => this.normalizeEntityField(field)));
  }

  private async fetchEntityFieldsFromNetwork(publicCollectionName: string): Promise<EntityField[]> {
    try {
      const endpoint = `/metadata/PublicEntities?$filter=EntitySetName eq '${escapeODataKey(publicCollectionName)}'`;
      const response = await this.client.get<unknown>(endpoint);
      const publicEntities = extractCollection<PublicEntityMetadataRaw>(response.data);
      const fields = this.getEntityFieldsFromPublicEntities(publicEntities, publicCollectionName);
      await this.saveCachedEntityFields(publicCollectionName, fields);
      return fields;
    } catch (err) {
      throw handleApiError(err as AxiosError);
    }
  }

  private mapPublicEnumerationsToEnumMap(
    enumerations: PublicEnumerationRaw[],
  ): Map<string, Array<{ name: string; value: number }>> {
    const enumMap = new Map<string, Array<{ name: string; value: number }>>();

    for (const enumeration of enumerations) {
      if (!enumeration.Name) continue;

      const members = (enumeration.Members ?? [])
        .map((member) => {
          const value = typeof member.Value === 'number'
            ? member.Value
            : Number.parseInt(String(member.Value ?? ''), 10);

          if (!member.Name || Number.isNaN(value)) return null;
          return { name: member.Name, value };
        })
        .filter((member): member is { name: string; value: number } => member !== null);

      enumMap.set(enumeration.Name, members);
      const shortName = enumeration.Name.split('.').pop();
      if (shortName && !enumMap.has(shortName)) {
        enumMap.set(shortName, members);
      }
    }

    return enumMap;
  }

  private async fetchEntitiesFromNetwork(): Promise<DataEntity[]> {
    // Step 1: base entity list
    let base: DataEntityRaw[];
    try {
      const res = await this.client.get<{ value: DataEntityRaw[] }>('/metadata/DataEntities');
      base = res.data.value;
    } catch (err) {
      throw handleApiError(err as AxiosError);
    }

    // Step 2: DMF enrichment (EntityName / Modules / IsShared)
    const entities = this.mapEntities(base, await this.fetchDataManagementMap());
    await this.saveMetadataCachePatch({
      dataEntitiesJson: encodeCacheValue(entities),
    });

    return entities;
  }

  private async fetchAllPublicEntitiesFromNetwork(): Promise<PublicEntityMetadataRaw[]> {
    try {
      const response = await this.client.get<unknown>('/metadata/PublicEntities');
      const publicEntities = extractCollection<PublicEntityMetadataRaw>(response.data);
      await this.saveMetadataCachePatch({
        publicEntitiesJson: encodeCacheValue(publicEntities),
      });
      return publicEntities;
    } catch (err) {
      throw handleApiError(err as AxiosError);
    }
  }

  private async fetchAllPublicEnumerationsFromNetwork(): Promise<PublicEnumerationRaw[]> {
    try {
      const response = await this.client.get<unknown>('/metadata/PublicEnumerations');
      const publicEnumerations = extractCollection<PublicEnumerationRaw>(response.data);
      await this.saveMetadataCachePatch({
        publicEnumerationsJson: encodeCacheValue(publicEnumerations),
      });
      return publicEnumerations;
    } catch (err) {
      throw handleApiError(err as AxiosError);
    }
  }

  async fetchEntities(forceRefresh = false): Promise<DataEntity[]> {
    if (!forceRefresh) {
      const cached = await this.getCachedDataEntities();
      if (cached) return cached;
    }

    return this.fetchEntitiesFromNetwork();
  }

  async warmMetadataCaches(): Promise<void> {
    const cacheEntry = await this.getMetadataCacheEntry();

    if (!cacheEntry?.dataEntitiesJson) {
      await this.fetchEntitiesFromNetwork().catch(() => undefined);
    }

    if (!cacheEntry?.publicEnumerationsJson) {
      await this.fetchAllPublicEnumerationsFromNetwork().catch(() => undefined);
    }
  }

  async refreshMetadataCaches(): Promise<void> {
    await this.fetchEntitiesFromNetwork();
    await this.fetchAllPublicEntitiesFromNetwork();
    await this.fetchAllPublicEnumerationsFromNetwork();

    await this.saveMetadataCachePatch({
      publicEntityFieldsJsonByCollection: {},
    });
  }

  async clearMetadataCache(): Promise<void> {
    const cache = await storageService.getMetadataCache();
    const cacheKey = getMetadataCacheKey(this.baseUrl);
    if (!(cacheKey in cache)) return;

    const nextCache = { ...cache };
    delete nextCache[cacheKey];
    await storageService.set('metadataCache', nextCache);
  }

  async fetchEntityFields(publicCollectionName: string, languageId?: string, forceRefresh = false): Promise<EntityField[]> {
    const cachedFields = forceRefresh ? null : await this.getCachedEntityFields(publicCollectionName);
    if (cachedFields) {
      return this.resolveEntityFieldLabels(cachedFields, languageId, forceRefresh);
    }

    if (!forceRefresh) {
      const cachedPublicEntities = await this.getCachedPublicEntities();
      const fields = cachedPublicEntities
        ? this.getEntityFieldsFromPublicEntities(cachedPublicEntities, publicCollectionName)
        : [];

      if (fields.length > 0) {
        await this.saveCachedEntityFields(publicCollectionName, fields);
        return this.resolveEntityFieldLabels(fields, languageId, forceRefresh);
      }
    }

    const fields = await this.fetchEntityFieldsFromNetwork(publicCollectionName);
    return this.resolveEntityFieldLabels(fields, languageId, forceRefresh);
  }

  async fetchEntityData(
    collectionName: string,
    top: number,
    odataParams?: { filter?: string; select?: string; orderby?: string; skip?: string; count?: boolean; crossCompany?: boolean },
  ): Promise<{ records: Record<string, unknown>[]; totalCount?: number }> {
    try {
      const params: Record<string, string | number | boolean> = { '$top': top };
      if (odataParams?.filter)  params['$filter']  = odataParams.filter;
      if (odataParams?.select)  params['$select']  = odataParams.select;
      if (odataParams?.orderby) params['$orderby'] = odataParams.orderby;
      if (odataParams?.skip)    params['$skip']    = odataParams.skip;
      if (odataParams?.count)   params['$count']   = true;
      if (odataParams?.crossCompany) params['cross-company'] = true;
      const resp = await this.client.get<{ value: Record<string, unknown>[]; '@odata.count'?: number }>(`/data/${collectionName}`, { params });
      return {
        records: resp.data.value ?? [],
        totalCount: resp.data['@odata.count'],
      };
    } catch (err) {
      throw handleApiError(err as AxiosError);
    }
  }

  async fetchEntityCount(collectionName: string, filter?: string, crossCompany = false): Promise<number> {
    try {
      const params: Record<string, string> = {};
      if (filter) params['$filter'] = filter;
      if (crossCompany) params['cross-company'] = 'true';
      const resp = await this.client.get<string>(`/data/${collectionName}/$count`, {
        params,
        headers: { Accept: 'text/plain' },
      });
      return parseInt(String(resp.data), 10);
    } catch (err) {
      throw handleApiError(err as AxiosError);
    }
  }

  async fetchMetadataEnums(forceRefresh = false): Promise<Map<string, Array<{ name: string; value: number }>>> {
    const cachedPublicEnumerations = forceRefresh ? null : await this.getCachedPublicEnumerations();
    if (cachedPublicEnumerations) {
      return this.mapPublicEnumerationsToEnumMap(cachedPublicEnumerations);
    }

    try {
      const publicEnumerations = await this.fetchAllPublicEnumerationsFromNetwork();
      return this.mapPublicEnumerationsToEnumMap(publicEnumerations);
    } catch (err) {
      throw handleApiError(err as AxiosError);
    }
  }

  async executeOData(path: string): Promise<unknown> {
    try {
      const response = await this.client.get(path);
      return response.data;
    } catch (err) {
      throw handleApiError(err as AxiosError);
    }
  }
}
