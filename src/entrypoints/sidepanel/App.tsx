import { useCallback, useEffect, useState } from 'react';
import type { RuntimeMessage, ScanFieldsResponse } from '@/lib/messages';
import { sendToRuntime, sendToTab } from '@/lib/messages';
import type { AuthState, DetectedField } from '@/lib/types';
import { getMe, openLogin } from '@/services/auth';
import { generateAnswers } from '@/services/fill';
import { syncFields } from '@/services/sync';
import { AuthGate } from '@/components/AuthGate';
import { FieldList } from '@/components/FieldList';
import { SyncButton } from '@/components/SyncButton';

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });
  const [tabId, setTabId] = useState<number | null>(null);
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [scanning, setScanning] = useState(false);
  const [filling, setFilling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unsyncedCount = fields.filter((f) => !f.synced).length;

  const refreshAuth = useCallback(async () => {
    try {
      const user = await getMe();
      setAuth(user ? { status: 'authed', user } : { status: 'unauthed' });
    } catch {
      setAuth({ status: 'unauthed' });
      setError('Could not reach the Iris API. Is it running?');
    }
  }, []);

  // Auth check on mount + whenever the panel regains focus (e.g. after logging in elsewhere).
  useEffect(() => {
    refreshAuth();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAuth();
    };
    window.addEventListener('focus', refreshAuth);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', refreshAuth);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshAuth]);

  // Reset field state when the user switches tab or navigates.
  useEffect(() => {
    const reset = () => setFields([]);
    const onUpdated = (_id: number, info: { url?: string }) => {
      if (info.url) reset();
    };
    browser.tabs.onActivated.addListener(reset);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      browser.tabs.onActivated.removeListener(reset);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  const fillFields = useCallback(
    async (targets: DetectedField[]) => {
      if (tabId == null || targets.length === 0) return;
      setFilling(true);
      setError(null);
      try {
        const { answers } = await generateAnswers({ fields: targets });
        await sendToTab(tabId, { type: 'FILL_FIELDS', payload: { answers } });
        setFields((prev) =>
          prev.map((f) => {
            const answer = answers.find((a) => a.fieldId === f.id);
            return answer ? { ...f, value: answer.value, filledBy: 'ai' as const, synced: false } : f;
          }),
        );
      } catch (e) {
        setError(`Fill failed: ${e instanceof Error ? e.message : e}`);
      } finally {
        setFilling(false);
      }
    },
    [tabId],
  );

  // Messages from the content script.
  useEffect(() => {
    const listener = (message: RuntimeMessage) => {
      switch (message.type) {
        case 'FIELDS_DETECTED':
          setFields(message.payload.fields);
          break;
        case 'FIELD_EDITED':
          setFields((prev) =>
            prev.map((f) =>
              f.id === message.payload.fieldId
                ? { ...f, value: message.payload.value, filledBy: 'user', synced: false }
                : f,
            ),
          );
          break;
        case 'FILL_REQUESTED': {
          const field = fields.find((f) => f.id === message.payload.fieldId);
          if (field) fillFields([field]);
          break;
        }
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, [fields, fillFields]);

  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab');
      setTabId(tab.id);
      await sendToRuntime({ type: 'INJECT_CONTENT', payload: { tabId: tab.id } });
      const res = await sendToTab<ScanFieldsResponse>(tab.id, { type: 'SCAN_FIELDS' });
      setFields(res.fields);
    } catch (e) {
      setError(`Scan failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setScanning(false);
    }
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      await syncFields(fields);
      setFields((prev) => prev.map((f) => ({ ...f, synced: true })));
    } catch (e) {
      setError(`Sync failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSyncing(false);
    }
  }, [fields]);

  return (
    <div className="flex h-screen flex-col bg-white text-sm text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h1 className="text-base font-semibold text-violet-700">Iris</h1>
        {auth.status === 'authed' && <span className="truncate text-xs text-gray-500">{auth.user.email}</span>}
      </header>

      <AuthGate auth={auth} onLogin={openLogin}>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex gap-2">
            <button
              onClick={scan}
              disabled={scanning}
              className="flex-1 rounded-md border border-violet-600 px-3 py-2 font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              {scanning ? 'Scanning…' : 'Scan this page'}
            </button>
            <SyncButton count={unsyncedCount} syncing={syncing} onSync={sync} />
          </div>

          {fields.length > 0 && (
            <button
              onClick={() => fillFields(fields)}
              disabled={filling}
              className="rounded-md bg-violet-600 px-3 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {filling ? 'Filling…' : 'Complete application'}
            </button>
          )}

          {error && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <FieldList fields={fields} />
        </div>
      </AuthGate>
    </div>
  );
}
