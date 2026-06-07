import React from 'react';

export const NO_ENTRY = <span className="text-surface-300 dark:text-surface-600 italic text-xs">&mdash;</span>;

export function BoolCell({ value, size = 'xs' }: { value: boolean; size?: 'xs' | 'sm' }) {
  const textSize = size === 'sm' ? 'text-sm' : 'text-xs';
  return value ? (
    <span className={`${textSize} font-medium text-green-600 dark:text-green-400`}>Yes</span>
  ) : (
    <span className={`${textSize} text-surface-300 dark:text-surface-600`}>No</span>
  );
}
