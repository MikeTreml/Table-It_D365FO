import React, { useState } from 'react';
import { Plus, Trash2, Check, Sun, Moon, Monitor, ChevronDown, ChevronUp, RotateCcw, Pencil } from 'lucide-react';
import { useProfileStore } from '@shared/stores/profileStore';
import { useSettingsStore } from '@shared/stores/settingsStore';
import { LANGUAGES, COLOR_PRESETS } from '@shared/constants';
import { contrastRatio } from '@shared/hooks/useAppTheme';
import { getPresetTheme, getResetPreset } from '@shared/utils/colorPresets';
import type { ColorTheme, ColorSeeds, ColorSeedsDark, Profile, Theme } from '@shared/types';


// ─── Contrast badge ───────────────────────────────────────────────────────────

function ContrastBadge({ fg, bg, label }: { fg: string; bg: string; label: string }) {
  let ratio = 1;
  try { ratio = contrastRatio(fg, bg); } catch { /* ignore bad hex mid-edit */ }
  const pass = ratio >= 4.5;
  const large = ratio >= 3.0;
  return (
    <span
      title={`${label}: ${ratio.toFixed(1)}:1 — ${pass ? 'AA pass' : large ? 'AA large only' : 'fail'}`}
      className={[
        'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums',
        pass  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
        large ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      ].join(' ')}
    >
      {ratio.toFixed(1)}
    </span>
  );
}

// ─── Color picker row ─────────────────────────────────────────────────────────

function ColorRow({
  label, value, onChange,
  contrastFg, contrastBg, contrastLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  contrastFg?: string;
  contrastBg?: string;
  contrastLabel?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded border border-surface-300 dark:border-surface-600 shrink-0 cursor-pointer overflow-hidden relative"
        title={value}
      >
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        />
        <div className="w-full h-full" style={{ backgroundColor: value }} />
      </div>
      <span className="text-xs text-surface-600 dark:text-surface-300 flex-1 min-w-0 truncate">{label}</span>
      <span className="text-[10px] text-surface-400 dark:text-surface-500 tabular-nums shrink-0">{value}</span>
      {contrastFg && contrastBg && contrastLabel && (
        <ContrastBadge fg={contrastFg} bg={contrastBg} label={contrastLabel} />
      )}
    </div>
  );
}

// ─── Preset swatch card ───────────────────────────────────────────────────────

function PresetCard({
  name, theme, active, onSelect, tooltip,
}: {
  id: string; name: string; theme: ColorTheme; active: boolean; onSelect: () => void; tooltip?: string;
}) {
  const { toolbar, primaryAction, highlight } = theme.light;
  return (
    <button
      onClick={onSelect}
      className={[
        'flex flex-col rounded-lg overflow-hidden border-2 transition-all',
        active
          ? 'border-brand-600 shadow-md scale-[1.02]'
          : 'border-surface-200 dark:border-surface-700 hover:border-surface-400 dark:hover:border-surface-500',
      ].join(' ')}
      title={tooltip ?? name}
    >
      {/* Header strip */}
      <div className="h-5 w-full" style={{ backgroundColor: toolbar }} />
      {/* Color dots */}
      <div
        className="flex items-center justify-center gap-1 px-2 py-1.5"
        style={{ backgroundColor: theme.light.pageBg }}
      >
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryAction }} />
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: highlight }} />
        {active && <Check className="w-2.5 h-2.5 ml-0.5" style={{ color: primaryAction }} />}
      </div>
      {/* Name */}
      <div
        className="text-[9px] font-medium text-center pb-1 leading-none"
        style={{ backgroundColor: theme.light.pageBg, color: theme.light.bodyText }}
      >
        {name}
      </div>
    </button>
  );
}

// ─── Color Theme section ──────────────────────────────────────────────────────

function ColorThemeSection() {
  const { settings, setColorTheme, setColorPresetTheme, resetColorPresetTheme } = useSettingsStore();
  const { profiles, activeProfileId, update } = useProfileStore();
  const [expanded, setExpanded] = useState(false);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const selectedPresetId = activeProfile?.colorPresetId ?? settings.colorTheme?.presetId ?? COLOR_PRESETS[0].id;
  const ct: ColorTheme = getPresetTheme(settings, selectedPresetId);

  const savePresetTheme = (nextTheme: ColorTheme) => {
    const presetTheme = { ...nextTheme, presetId: selectedPresetId };
    setColorPresetTheme(selectedPresetId, presetTheme);
    if (activeProfile) {
      update(activeProfile.id, {
        colorPresetId: selectedPresetId,
        color: presetTheme.light.primaryAction,
      });
    } else {
      setColorTheme(presetTheme);
    }
  };

  const updateLight = (patch: Partial<ColorSeeds>) => {
    savePresetTheme({ ...ct, light: { ...ct.light, ...patch } });
  };

  const updateDark = (patch: Partial<ColorSeedsDark>) => {
    savePresetTheme({ ...ct, dark: { ...ct.dark, ...patch } });
  };

  const selectPreset = (id: string) => {
    const preset = COLOR_PRESETS.find(p => p.id === id);
    if (!preset) return;
    const theme = getPresetTheme(settings, preset.id);
    if (activeProfile) {
      update(activeProfile.id, {
        colorPresetId: preset.id,
        color: theme.light.primaryAction,
      });
    } else {
      setColorTheme(theme);
    }
  };

  const resetToPreset = () => {
    const base = getResetPreset(ct);
    resetColorPresetTheme(base.id);
    if (activeProfile) {
      update(activeProfile.id, {
        colorPresetId: base.id,
        color: base.theme.light.primaryAction,
      });
    } else {
      setColorTheme(base.theme);
    }
  };

  return (
    <section title="Choose a color palette for the extension — pick a preset or fine-tune individual colors below">

      {/* Preset grid — no heading */}
      <div className="grid grid-cols-6 gap-1.5 mb-2">
        {COLOR_PRESETS.map(p => (
          <PresetCard
            key={p.id}
            id={p.id}
            name={p.name}
            theme={getPresetTheme(settings, p.id)}
            active={selectedPresetId === p.id}
            onSelect={() => selectPreset(p.id)}
            tooltip={`Apply the ${p.name} color palette`}
          />
        ))}
      </div>

      {/* Customize toggle */}
      <button
        onClick={() => setExpanded(v => !v)}
        title="Fine-tune individual colors — changes update live across all pages"
        className="flex items-center gap-1 px-2 py-1 rounded text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
      >
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        Customize colors
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-3 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">

          {/* Light mode */}
          <div>
            <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-1.5">Light mode</p>
            <div className="flex flex-col gap-1.5">
              <ColorRow
                label="Primary Action"
                value={ct.light.primaryAction}
                onChange={v => updateLight({ primaryAction: v })}
                contrastFg={ct.light.bodyText} contrastBg={ct.light.pageBg} contrastLabel="text/bg"
              />
              <ColorRow
                label="Highlight / Accent"
                value={ct.light.highlight}
                onChange={v => updateLight({ highlight: v })}
              />
              <ColorRow
                label="Page Background"
                value={ct.light.pageBg}
                onChange={v => updateLight({ pageBg: v })}
              />
              <ColorRow
                label="Toolbar"
                value={ct.light.toolbar}
                onChange={v => updateLight({ toolbar: v })}
                contrastFg="#ffffff" contrastBg={ct.light.toolbar} contrastLabel="white/toolbar"
              />
              <ColorRow
                label="Body Text"
                value={ct.light.bodyText}
                onChange={v => updateLight({ bodyText: v })}
                contrastFg={ct.light.bodyText} contrastBg={ct.light.pageBg} contrastLabel="text/bg"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-surface-200 dark:border-surface-700" />

          {/* Dark mode */}
          <div>
            <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide mb-1.5">Dark mode</p>
            <div className="flex flex-col gap-1.5">
              <ColorRow
                label="Page Background"
                value={ct.dark.pageBg}
                onChange={v => updateDark({ pageBg: v })}
              />
              <ColorRow
                label="Panel / Card"
                value={ct.dark.panelBg}
                onChange={v => updateDark({ panelBg: v })}
              />
              <ColorRow
                label="Toolbar"
                value={ct.dark.toolbar}
                onChange={v => updateDark({ toolbar: v })}
                contrastFg="#ffffff" contrastBg={ct.dark.toolbar} contrastLabel="white/toolbar"
              />
              <ColorRow
                label="Body Text"
                value={ct.dark.bodyText}
                onChange={v => updateDark({ bodyText: v })}
                contrastFg={ct.dark.bodyText} contrastBg={ct.dark.pageBg} contrastLabel="text/bg"
              />
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={resetToPreset}
            className="flex items-center gap-1.5 self-end px-2 py-1 rounded text-xs text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to {getResetPreset(ct).name}
          </button>
        </div>
      )}
    </section>
  );
}

// ─── ConfigTab ────────────────────────────────────────────────────────────────

export function ConfigTab() {
  const { profiles, activeProfileId, activeProfile, add, update, remove, setActive } = useProfileStore();
  const { settings, setTheme, setHighContrastBw } = useSettingsStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);

  const sortedProfiles = [...profiles].sort((a, b) => a.name.localeCompare(b.name));
  const currentProfile = activeProfile();
  const effectiveTheme = currentProfile?.themeMode ?? settings.theme;
  const setEffectiveTheme = (theme: Theme) => {
    if (currentProfile) {
      update(currentProfile.id, { themeMode: theme });
    } else {
      setTheme(theme);
    }
  };

  const themeModes = [
    { value: 'light', label: 'Light', Icon: Sun,     tip: 'Always use light mode' },
    { value: 'dark',  label: 'Dark',  Icon: Moon,    tip: 'Always use dark mode' },
    { value: 'auto',  label: 'Auto',  Icon: Monitor, tip: 'Follow your system preference' },
  ] as const;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed top section */}
      <div className="flex flex-col gap-4 p-3 shrink-0">
        {/* Light/dark mode — no heading */}
        <div className="flex gap-1.5">
          {themeModes.map(({ value, label, Icon, tip }) => (
            <button
              key={value}
              onClick={() => setEffectiveTheme(value as Theme)}
              title={tip}
              className={[
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                effectiveTheme === value
                  ? 'bg-brand-600 border-brand-600 text-surface-50 dark:text-white'
                  : 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:border-surface-300 dark:hover:border-surface-600',
              ].join(' ')}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>


        <label
          title="Use a high-contrast black and white palette across all pages"
          className="flex items-start gap-2 px-2.5 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 cursor-pointer"
        >
          <input
            type="checkbox"
            checked={settings.highContrastBw ?? false}
            onChange={(event) => { void setHighContrastBw(event.target.checked); }}
            className="mt-0.5 rounded border-surface-300 text-brand-600 focus:ring-brand-600 focus:ring-offset-0"
          />
          <span className="flex flex-col leading-tight">
            <span className="text-xs font-semibold text-surface-700 dark:text-surface-200">
              High contrast black and white
            </span>
            <span className="text-[10px] text-surface-500 dark:text-surface-400">
              Overrides color presets while enabled.
            </span>
          </span>
        </label>        {/* Color Theme — no heading */}
        <ColorThemeSection />

        {/* Environments header + add form */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2
              className="text-xs font-semibold text-surface-400 dark:text-surface-500 uppercase tracking-wide"
              title="D365FO environment profiles — each stores a base URL, company, and language"
            >
              Environments
            </h2>
            <button
              onClick={() => {
                setEditingProfileId(null);
                setShowAddForm((v) => !v);
              }}
              title="Add a new D365FO environment"
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          {showAddForm && (
            <AddProfileForm
              onSave={async (data) => { await add(data); setShowAddForm(false); }}
              onCancel={() => setShowAddForm(false)}
              submitLabel="Add"
            />
          )}
        </div>
      </div>

      {/* Scrollable environments list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col gap-1.5">
          {sortedProfiles.length === 0 && !showAddForm && (
            <p className="text-xs text-surface-400 dark:text-surface-500 text-center py-3">
              No environments yet — add one above.
            </p>
          )}
          {sortedProfiles.map((profile) => {
            const presetColor = profile.colorPresetId
              ? getPresetTheme(settings, profile.colorPresetId).light.primaryAction
              : undefined;
            const dotColor = presetColor ?? profile.color;
            const isEditing = editingProfileId === profile.id;
            return (
            <React.Fragment key={profile.id}>
            <div
              className={[
                'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors',
                profile.id === activeProfileId
                  ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/10'
                  : 'border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600',
              ].join(' ')}
              style={presetColor ? { borderLeftWidth: '3px', borderLeftColor: presetColor } : undefined}
              onClick={() => setActive(profile.id)}
            >
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                  {profile.name}
                </div>
                <div className="text-xs text-surface-400 dark:text-surface-500 truncate">
                  {profile.baseUrl} · {profile.companyId}
                </div>
              </div>
              {profile.id === activeProfileId && (
                <Check className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddForm(false);
                  setEditingProfileId(isEditing ? null : profile.id);
                }}
                className="p-1 rounded text-surface-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors shrink-0"
                title={`Edit ${profile.name}`}
                aria-label={`Edit ${profile.name}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); remove(profile.id); }}
                className="p-1 rounded text-surface-300 dark:text-surface-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors shrink-0"
                title="Delete profile"
                aria-label={`Delete ${profile.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {isEditing && (
              <AddProfileForm
                initialData={profile}
                submitLabel="Save"
                onSave={async (data) => {
                  const preset = data.colorPresetId
                    ? getPresetTheme(settings, data.colorPresetId).light.primaryAction
                    : profile.color;
                  await update(profile.id, { ...data, color: preset });
                  setEditingProfileId(null);
                }}
                onCancel={() => setEditingProfileId(null)}
              />
            )}
            </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Add profile form ─────────────────────────────────────────────────────────

interface AddProfileFormProps {
  onSave: (data: {
    name: string; baseUrl: string; companyId: string;
    languageId: string; limitedNav: boolean; isDefault: boolean;
    colorPresetId?: string; themeMode?: Theme;
  }) => void;
  onCancel: () => void;
  initialData?: Profile;
  submitLabel?: string;
}

function AddProfileForm({ onSave, onCancel, initialData, submitLabel = 'Save' }: AddProfileFormProps) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [baseUrl, setBaseUrl] = useState(initialData?.baseUrl ?? '');
  const [companyId, setCompanyId] = useState(initialData?.companyId ?? '');
  const [languageId, setLanguageId] = useState(initialData?.languageId ?? 'en-us');
  const [limitedNav, setLimitedNav] = useState(initialData?.limitedNav ?? false);
  const [colorPresetId, setColorPresetId] = useState(initialData?.colorPresetId ?? '');
  const [themeMode, setThemeMode] = useState(initialData?.themeMode ?? '');
  const isDefault = initialData?.isDefault ?? false;

  const isValid = name.trim() && baseUrl.trim() && companyId.trim();
  const selectedPreset = COLOR_PRESETS.find(p => p.id === colorPresetId);

  return (
    <div className="flex flex-col gap-2 p-3 mb-2 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
      <Field label="Name">
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Production" className={inputCls} />
      </Field>
      <Field label="Base URL">
        <input type="text" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
          placeholder="contoso.operations.dynamics.com" className={inputCls} />
      </Field>
      <Field label="Company ID">
        <input type="text" value={companyId} onChange={e => setCompanyId(e.target.value)}
          placeholder="e.g. USMF" className={inputCls} />
      </Field>
      <Field label="Language">
        <div className="relative">
          <select value={languageId} onChange={e => setLanguageId(e.target.value)}
            className={`${inputCls} appearance-none pr-7`}>
            {LANGUAGES.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
        </div>
      </Field>
      <Field label="Color Theme">
        <div className="relative">
          <select value={colorPresetId} onChange={e => setColorPresetId(e.target.value)}
            className={`${inputCls} appearance-none pr-7`}
            style={selectedPreset ? { borderLeftWidth: '3px', borderLeftColor: selectedPreset.theme.light.primaryAction } : undefined}>
            <option value="">Use current</option>
            {COLOR_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
        </div>
      </Field>
      <Field label="Appearance">
        <div className="relative">
          <select value={themeMode} onChange={e => setThemeMode(e.target.value)}
            className={`${inputCls} appearance-none pr-7`}>
            <option value="">Use current</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-400 pointer-events-none" />
        </div>
      </Field>
      <label className="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-300 cursor-pointer">
        <input type="checkbox" checked={limitedNav} onChange={e => setLimitedNav(e.target.checked)}
          className="rounded border-surface-300 text-brand-600 focus:ring-brand-600" />
        Limited navigation
      </label>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave({
            name, baseUrl, companyId, languageId, limitedNav, isDefault,
            colorPresetId: colorPresetId || undefined,
            themeMode: (themeMode as Theme) || undefined,
          })}
          disabled={!isValid}
          className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-brand-600 text-[var(--color-body-text)] dark:text-white hover:bg-brand-700 disabled:opacity-40 transition-colors"
        >
          {submitLabel}
        </button>
        <button onClick={onCancel}
          className="flex-1 py-1.5 text-xs font-medium rounded-lg border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs font-medium text-surface-500 dark:text-surface-400">{label}</label>
      {children}
    </div>
  );
}

const inputCls = [
  'w-full px-2.5 py-1.5 text-xs rounded-md border',
  'bg-white dark:bg-surface-900',
  'border-surface-200 dark:border-surface-700',
  'text-surface-800 dark:text-surface-200',
  'placeholder-surface-400 dark:placeholder-surface-500',
  'focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600',
].join(' ');
