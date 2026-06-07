import type { ReactNode } from 'react';
import type { Profile } from '@shared/types';

export const BROWSER_TOOLBAR_CLS = [
  'flex flex-col gap-1 px-4 py-2.5',
  'bg-gradient-to-r from-brand-900 via-brand-900 to-brand-800',
  'text-surface-50 shrink-0',
].join(' ');

export const BROWSER_TOOLBAR_ROW_CLS = 'flex items-center gap-3 min-w-0';

export const BROWSER_TOOLBAR_BUTTON_CLS = [
  'bg-surface-800 border border-surface-200 dark:border-surface-700',
  'text-surface-100',
  'hover:bg-surface-50 dark:hover:bg-surface-900',
  'hover:text-brand-700 dark:hover:text-surface-100',
  'disabled:opacity-40 transition-colors',
].join(' ');

export const BROWSER_TOOLBAR_ACTION_CLS = [
  'flex items-center gap-1.5 px-3 py-1.5',
  'text-xs font-medium rounded-lg shrink-0',
  BROWSER_TOOLBAR_BUTTON_CLS,
].join(' ');

export const BROWSER_TOOLBAR_BUTTON_ACTIVE_CLS = [
  'bg-surface-50 dark:bg-surface-900',
  'border border-surface-200 dark:border-surface-700',
  'text-brand-700 dark:text-surface-100',
].join(' ');

export const BROWSER_TOOLBAR_ACTION_ACTIVE_CLS = [
  'flex items-center gap-1.5 px-3 py-1.5',
  'text-xs font-medium rounded-lg shrink-0',
  BROWSER_TOOLBAR_BUTTON_ACTIVE_CLS,
].join(' ');

export const BROWSER_TOOLBAR_INPUT_CLS = [
  'px-3 py-2 text-sm rounded-lg border',
  'bg-white dark:bg-surface-800',
  'border-surface-200 dark:border-surface-600',
  'text-surface-800 dark:text-white',
  'placeholder-surface-400 dark:placeholder-surface-200',
  'focus:outline-none focus:ring-2 focus:ring-brand-600/30 focus:border-brand-600',
  'transition-colors',
].join(' ');

interface BrowserToolbarIdentityProps {
  icon: ReactNode;
  title: string;
}

interface BrowserToolbarProps {
  children: ReactNode;
  statusRow?: ReactNode;
}

interface BrowserToolbarProfileProps {
  profile: Profile | null;
}

export function BrowserToolbar({ children, statusRow }: BrowserToolbarProps) {
  return (
    <div className={BROWSER_TOOLBAR_CLS}>
      <div className={BROWSER_TOOLBAR_ROW_CLS}>
        {children}
      </div>
      {statusRow && (
        <div className="text-[11px] text-surface-300 pl-[34px]">
          {statusRow}
        </div>
      )}
    </div>
  );
}

export function BrowserToolbarIdentity({ icon, title }: BrowserToolbarIdentityProps) {
  return (
    <div className="flex items-center gap-3 text-accent-400 shrink-0 min-w-0">
      <div className="shrink-0 text-white">{icon}</div>
      <span className="text-2xl font-semibold text-surface-50 shrink-0 truncate max-w-[72ch]" title={title}>
        {title}
      </span>
    </div>
  );
}

export function BrowserToolbarProfile({ profile }: BrowserToolbarProfileProps) {
  const primaryText = profile
    ? `${profile.name} - ${profile.companyId}`
    : 'No profile configured';

  return (
    <span className={`truncate font-semibold shrink-0 ${profile ? 'text-3xl text-surface-50' : 'text-3xl text-accent-300'}`}>
      {primaryText}
    </span>
  );
}
