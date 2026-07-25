import type { RuntimeMessage } from '@/lib/messages';

export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel (also grants activeTab).
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('sidePanel.setPanelBehavior failed', err));

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
