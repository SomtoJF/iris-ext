import type { RuntimeMessage } from '@/lib/messages';

export default defineBackground(() => {
  // Toolbar click must open the panel without awaiting other APIs first —
  // sidePanel.open() loses the user gesture after an await (fails in store builds).
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
