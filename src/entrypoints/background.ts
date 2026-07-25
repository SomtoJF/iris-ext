import type { RuntimeMessage } from '@/lib/messages';

export default defineBackground(() => {
  // Panel is per-tab: disabled by default, enabled only on tabs where the
  // user clicks the toolbar icon. Switching to a non-activated tab hides it.
  browser.sidePanel
    .setOptions({ enabled: false })
    .catch((err) => console.error('sidePanel.setOptions failed', err));

  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id == null) return;
    await browser.sidePanel.setOptions({
      tabId: tab.id,
      path: 'sidepanel.html',
      enabled: true,
    });
    await browser.sidePanel.open({ tabId: tab.id });
  });

  browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type !== 'INJECT_CONTENT') return;
    browser.scripting
      .executeScript({
        target: { tabId: message.payload.tabId },
        files: ['/content-scripts/content.js'],
      })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // keep the message channel open for the async response
  });
});
