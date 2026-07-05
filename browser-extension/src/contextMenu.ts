export function createContextMenu(): void {
  chrome.contextMenus.create({
    id: 'pn-add-word',
    title: 'Add “%s” to Project PN',
    contexts: ['selection'],
  });
}

export function removeContextMenu(): void {
  chrome.contextMenus.removeAll();
}
