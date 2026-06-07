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

async function openOrFocus(url: string) {
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length > 0 && tabs[0].id != null) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId != null) {
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url });
  }
}
