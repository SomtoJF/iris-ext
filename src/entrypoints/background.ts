import type { RuntimeMessage } from '@/lib/messages';

export default defineBackground(() => {
  // Toolbar click must open the panel without awaiting other APIs first —
  // sidePanel.open() loses the user gesture after an await (fails in store builds).
  browser.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('sidePanel.setPanelBehavior failed', err));

  browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type !== 'INJECT_CONTENT') return;
    const tabId = message.payload.tabId;
    const inject = (allFrames: boolean) =>
      browser.scripting.executeScript({
        target: { tabId, allFrames },
        files: ['/content-scripts/content.js'],
      });
    inject(true)
      .catch(() => inject(false))
      .then((results) => {
        const frameIds = [
          ...new Set(
            (results ?? [])
              .map((r) => r.frameId)
              .filter((id): id is number => id != null),
          ),
        ];
        sendResponse({ ok: true, frameIds: frameIds.length > 0 ? frameIds : [0] });
      })
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // keep the message channel open for the async response
  });
});
