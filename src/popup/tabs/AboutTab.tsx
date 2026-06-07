import React from 'react';
import { Github, ExternalLink } from 'lucide-react';
import { D365FO_VERSION } from '@shared/constants';

const manifest = chrome.runtime.getManifest();
const iconUrl = chrome.runtime.getURL('icon128.png');

export function AboutTab() {
  return (
    <div className="flex flex-col items-center gap-4 p-3 text-center">
      {/* Icon */}
      <div className="w-32 h-32 rounded-xl bg-surface-50 dark:bg-surface-900 flex items-center justify-center overflow-hidden">
        <img src={iconUrl} alt="" className="w-full h-full object-contain" />
      </div>

      {/* Name & version */}
      <div>
        <h2 className="text-base font-semibold text-surface-800 dark:text-surface-200">
          {manifest.name}
        </h2>
        <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
          Version {manifest.version}
        </p>
      </div>

      {/* D365FO version */}
      <div className="w-full px-4 py-2.5 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 text-left">
        <p className="text-xs font-medium text-surface-500 dark:text-surface-400">
          Table data extracted from
        </p>
        <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 mt-0.5">
          Microsoft Dynamics 365 Finance &amp; Operations {D365FO_VERSION}
        </p>
        <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">
          {(18747).toLocaleString()} tables included
        </p>
      </div>

      {/* Links */}
      <div className="flex flex-col gap-2 w-full">
        <a
          href="https://github.com/MikeTreml/Table-It_D365FO"
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors"
        >
          <Github className="w-3.5 h-3.5" />
          View on GitHub
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>
      </div>

      <p className="text-xs text-surface-300 dark:text-surface-600">
        Not affiliated with Microsoft Corporation.
      </p>
    </div>
  );
}
