import React from 'react';
import { X } from 'lucide-react';

interface SidePanelProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export function SidePanel({ title, open, onClose, children, width = 'w-96' }: SidePanelProps) {
  return (
    <div
      className={[
        'flex flex-col h-full border-l border-surface-200 dark:border-surface-700',
        'bg-white dark:bg-surface-900 transition-all duration-200 overflow-hidden',
        open ? width : 'w-0 border-l-0',
      ].join(' ')}
    >
      {open && (
        <>
          <div className="flex items-center justify-between px-4 py-3 bg-brand-600 dark:bg-brand-900/30 border-b border-brand-900 dark:border-brand-700 shrink-0">
            <h3 className="font-semibold text-sm text-surface-50 dark:text-white truncate">
              {title}
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded text-surface-50 dark:text-white hover:bg-brand-700 dark:hover:bg-brand-900/50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">{children}</div>
        </>
      )}
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm text-surface-800 dark:text-surface-200 break-words">
        {value ?? <span className="text-surface-300 dark:text-surface-600 italic">—</span>}
      </span>
    </div>
  );
}

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const variants = {
    default: 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300',
    success: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
    danger: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
    info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${variants[variant]}`}>
      {label}
    </span>
  );
}
