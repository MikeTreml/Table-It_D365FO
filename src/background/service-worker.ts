chrome.runtime.onInstalled.addListener(() => {
  console.log('[Table It D365FO] Extension installed.');
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-tables') {
    openOrFocus(chrome.runtime.getURL('Tables.html'));
  } else if (command === 'open-entities') {
    openOrFocus(chrome.runtime.getURL('Entities.html'));
  }
});

// chrome.runtime.getContexts (Chrome 116+) finds our own open pages without the
// "tabs" permission, which would add a "Read your browsing history" install warning.
async function openOrFocus(url: string) {
  const contexts = chrome.runtime.getContexts
    ? await chrome.runtime.getContexts({
        contextTypes: [chrome.runtime.ContextType.TAB],
        documentUrls: [url],
      })
    : [];
  const existing = contexts.find((context) => context.tabId !== -1);
  if (!existing) {
    await chrome.tabs.create({ url });
    return;
  }
  await chrome.tabs.update(existing.tabId, { active: true });
  if (existing.windowId !== -1) {
    await chrome.windows.update(existing.windowId, { focused: true });
  }
}
