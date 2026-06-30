chrome.runtime.onInstalled.addListener(() => {
  console.log('[Table It D365FO] Extension installed.');
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-tables') {
    openExtensionPage(chrome.runtime.getURL('Tables.html'));
  } else if (command === 'open-entities') {
    openExtensionPage(chrome.runtime.getURL('Entities.html'));
  }
});

async function openExtensionPage(url: string) {
  await chrome.tabs.create({ url });
}
