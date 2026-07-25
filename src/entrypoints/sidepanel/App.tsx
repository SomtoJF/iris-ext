import { useCallback, useEffect, useRef, useState } from "react";
import type { RuntimeMessage, ScanFieldsResponse } from "@/lib/messages";
import { sendToRuntime, sendToTab } from "@/lib/messages";
import type { AuthState, DetectedField } from "@/lib/types";
import { getMe, openLogin } from "@/services/auth";
import { generateAnswers } from "@/services/fill";
import { syncFields } from "@/services/sync";
import { AuthGate } from "@/components/AuthGate";
import { FieldList } from "@/components/FieldList";
import { SyncButton } from "@/components/SyncButton";

type FieldsByTab = Record<number, DetectedField[]>;

const STORAGE_KEY = "fieldsByTab";

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [tabId, setTabId] = useState<number | null>(null);
  const [fieldsByTab, setFieldsByTab] = useState<FieldsByTab>({});
  const [scanning, setScanning] = useState(false);
  const [filling, setFilling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useRef(false);

  const fields = tabId != null ? (fieldsByTab[tabId] ?? []) : [];
  const unsyncedCount = fields.filter((f) => !f.synced).length;

  const setTabFields = useCallback(
    (tab: number, update: (prev: DetectedField[]) => DetectedField[]) => {
      setFieldsByTab((prev) => ({ ...prev, [tab]: update(prev[tab] ?? []) }));
    },
    [],
  );

  // Restore per-tab progress: Chrome can recreate the panel document on tab switches.
  useEffect(() => {
    (async () => {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tab?.id != null) setTabId(tab.id);
      const stored = await browser.storage.session.get(STORAGE_KEY);
      if (stored[STORAGE_KEY])
        setFieldsByTab(stored[STORAGE_KEY] as FieldsByTab);
      hydrated.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    browser.storage.session.set({ [STORAGE_KEY]: fieldsByTab });
  }, [fieldsByTab]);

  const refreshAuth = useCallback(async () => {
    try {
      const user = await getMe();
      setAuth(user ? { status: "authed", user } : { status: "unauthed" });
    } catch {
      setAuth({ status: "unauthed" });
      setError("Could not reach the Iris API. Is it running?");
    }
  }, []);

  // Auth check on mount + whenever the panel regains focus (e.g. after logging in elsewhere).
  useEffect(() => {
    refreshAuth();
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshAuth();
    };
    window.addEventListener("focus", refreshAuth);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", refreshAuth);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshAuth]);

  // Track the active tab; drop a tab's progress only when it navigates away or closes.
  useEffect(() => {
    const onActivated = (info: { tabId: number }) => setTabId(info.tabId);
    const onUpdated = (id: number, info: { url?: string }) => {
      if (info.url)
        setFieldsByTab((prev) => {
          const { [id]: _dropped, ...rest } = prev;
          return rest;
        });
    };
    const onRemoved = (id: number) =>
      setFieldsByTab((prev) => {
        const { [id]: _dropped, ...rest } = prev;
        return rest;
      });
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(onRemoved);
    return () => {
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(onRemoved);
    };
  }, []);

  const fillFields = useCallback(
    async (tab: number, targets: DetectedField[]) => {
      if (targets.length === 0) return;
      setFilling(true);
      setError(null);
      try {
        const { answers } = await generateAnswers({ fields: targets });
        await sendToTab(tab, { type: "FILL_FIELDS", payload: { answers } });
        setTabFields(tab, (prev) =>
          prev.map((f) => {
            const answer = answers.find((a) => a.fieldId === f.id);
            return answer
              ? {
                  ...f,
                  value: answer.value,
                  filledBy: "ai" as const,
                  synced: false,
                }
              : f;
          }),
        );
      } catch (e) {
        setError(`Fill failed: ${e instanceof Error ? e.message : e}`);
      } finally {
        setFilling(false);
      }
    },
    [setTabFields],
  );

  // Messages from content scripts; sender.tab identifies which tab they came from.
  useEffect(() => {
    const listener = (
      message: RuntimeMessage,
      sender: { tab?: { id?: number } },
    ) => {
      const senderTab = sender.tab?.id;
      if (senderTab == null) return;
      switch (message.type) {
        case "FIELDS_DETECTED":
          setTabFields(senderTab, () => message.payload.fields);
          break;
        case "FIELD_EDITED":
          setTabFields(senderTab, (prev) =>
            prev.map((f) =>
              f.id === message.payload.fieldId
                ? {
                    ...f,
                    value: message.payload.value,
                    filledBy: "user",
                    synced: false,
                  }
                : f,
            ),
          );
          break;
        case "FILL_REQUESTED": {
          setFieldsByTab((prev) => {
            const field = (prev[senderTab] ?? []).find(
              (f) => f.id === message.payload.fieldId,
            );
            if (field) fillFields(senderTab, [field]);
            return prev;
          });
          break;
        }
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, [setTabFields, fillFields]);

  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab?.id) throw new Error("No active tab");
      if (tab.url && !/^https?:/.test(tab.url)) {
        throw new Error(
          "This page cannot be scanned. Open a job application page first.",
        );
      }
      setTabId(tab.id);
      // activeTab evaporates on navigation; ask for persistent per-site access instead.
      const origin = `${new URL(tab.url!).origin}/*`;
      const granted =
        (await browser.permissions.contains({ origins: [origin] })) ||
        (await browser.permissions.request({ origins: [origin] }));
      if (!granted)
        throw new Error("Permission to access this site was declined.");
      const inject = await sendToRuntime<{ ok: boolean; error?: string }>({
        type: "INJECT_CONTENT",
        payload: { tabId: tab.id },
      });
      if (!inject?.ok)
        throw new Error(inject?.error ?? "Could not inject into the page");
      const res = await sendToTab<ScanFieldsResponse>(tab.id, {
        type: "SCAN_FIELDS",
      });
      setTabFields(tab.id, () => res.fields);
    } catch (e) {
      setError(`Scan failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setScanning(false);
    }
  }, [setTabFields]);

  const sync = useCallback(async () => {
    if (tabId == null) return;
    setSyncing(true);
    setError(null);
    try {
      await syncFields(fields);
      setTabFields(tabId, (prev) => prev.map((f) => ({ ...f, synced: true })));
    } catch (e) {
      setError(`Sync failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSyncing(false);
    }
  }, [tabId, fields, setTabFields]);

  return (
    <div className="flex h-screen flex-col bg-white text-sm text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h1 className="text-base font-semibold text-violet-700">Iris</h1>
        {auth.status === "authed" && (
          <span className="truncate text-xs text-gray-500">
            {auth.user.email}
          </span>
        )}
      </header>

      <AuthGate auth={auth} onLogin={openLogin}>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex gap-2">
            <button
              onClick={scan}
              disabled={scanning}
              className="flex-1 rounded-md border border-violet-600 px-3 py-2 font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              {scanning
                ? "Scanning…"
                : fields.length > 0
                  ? "Rescan page"
                  : "Scan this page"}
            </button>
            <SyncButton count={unsyncedCount} syncing={syncing} onSync={sync} />
          </div>

          {fields.length > 0 && (
            <button
              onClick={() => tabId != null && fillFields(tabId, fields)}
              disabled={filling}
              className="rounded-md bg-violet-600 px-3 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {filling ? "Filling…" : "Autofill all fields"}
            </button>
          )}

          {error && (
            <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <FieldList fields={fields} />
        </div>
      </AuthGate>
    </div>
  );
}
