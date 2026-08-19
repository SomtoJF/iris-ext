import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldAnswer, RuntimeMessage, ScanFieldsResponse } from "@/lib/messages";
import { sendToRuntime, sendToTab } from "@/lib/messages";
import type { AuthState, DetectedField } from "@/lib/types";
import { getMe, openLogin } from "@/services/auth";
import { generateAnswers } from "@/services/fill";
import { syncFields } from "@/services/sync";
import type { JobApplicationSummary } from "@/services/jobs";
import ApplicationScreen from "@/components/ApplicationScreen";
import { AuthGate } from "@/components/AuthGate";
import { HomeScreen } from "@/components/HomeScreen";
import { ArrowLeft } from "lucide-react";

interface TabSession {
  application?: JobApplicationSummary;
  fields: DetectedField[];
}

type SessionsByTab = Record<number, TabSession>;

const STORAGE_KEY = "sessionsByTab";

function isHttpUrl(url: string): boolean {
  return /^https?:/.test(url);
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [tabId, setTabId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionsByTab>({});
  const [scanning, setScanning] = useState(false);
  const [filling, setFilling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questionsRefreshKey, setQuestionsRefreshKey] = useState(0);
  const hydrated = useRef(false);

  const session = tabId != null ? sessions[tabId] : undefined;
  const fields = session?.fields ?? [];
  const applicationId = session?.application?.id ?? null;
  const unsyncedCount = fields.filter((f) => !f.synced).length;

  const setTabFields = useCallback(
    (tab: number, update: (prev: DetectedField[]) => DetectedField[]) => {
      setSessions((prev) => {
        const s = prev[tab];
        if (!s) return prev; // no session -> home view; ignore stray updates
        return { ...prev, [tab]: { ...s, fields: update(s.fields) } };
      });
    },
    [],
  );

  const bumpQuestionsRefresh = useCallback(() => {
    setQuestionsRefreshKey((k) => k + 1);
  }, []);

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
        setSessions(stored[STORAGE_KEY] as SessionsByTab);
      hydrated.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    browser.storage.session.set({ [STORAGE_KEY]: sessions });
  }, [sessions]);

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

  // Track the active tab. On navigation, keep the application on this tab
  // (multi-page / cross-origin ATS flows) and only clear scanned fields —
  // the content script dies on full page load and must be re-injected.
  useEffect(() => {
    const onActivated = (info: { tabId: number }) => setTabId(info.tabId);
    const onUpdated = (id: number, info: { url?: string }) => {
      if (!info.url || !isHttpUrl(info.url)) return;
      setSessions((prev) => {
        const s = prev[id];
        if (!s) return prev;
        if (s.fields.length === 0) return prev;
        return { ...prev, [id]: { ...s, fields: [] } };
      });
    };
    const onRemoved = (id: number) =>
      setSessions((prev) => {
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

  const startNew = useCallback(() => {
    if (tabId == null) return;
    setSessions((prev) => ({ ...prev, [tabId]: { fields: [] } }));
  }, [tabId]);

  const continueApplication = useCallback(
    (app: JobApplicationSummary) => {
      if (tabId == null) return;
      setSessions((prev) => ({
        ...prev,
        [tabId]: { application: app, fields: [] },
      }));
    },
    [tabId],
  );

  const openApplicationUrl = useCallback(
    async (url: string) => {
      if (tabId == null) return;
      await browser.tabs.update(tabId, { url });
    },
    [tabId],
  );

  const goHome = useCallback(() => {
    if (tabId == null) return;
    setSessions((prev) => {
      const { [tabId]: _dropped, ...rest } = prev;
      return rest;
    });
  }, [tabId]);

  const handleApplicationCreated = useCallback(
    (app: JobApplicationSummary) => {
      if (tabId == null) return;
      setSessions((prev) => {
        const s = prev[tabId];
        if (!s) return prev;
        return { ...prev, [tabId]: { ...s, application: app } };
      });
    },
    [tabId],
  );

  const handleMarkedApplied = useCallback(() => {
    if (tabId == null) return;
    setSessions((prev) => {
      const s = prev[tabId];
      if (!s?.application) return prev;
      return {
        ...prev,
        [tabId]: {
          ...s,
          application: { ...s.application, status: "applied" },
        },
      };
    });
  }, [tabId]);

  const applyAnswersToTab = useCallback(
    async (
      tab: number,
      answers: FieldAnswer[],
      filledBy: "ai" | "saved",
    ) => {
      if (answers.length === 0) return;
      await sendToTab(tab, { type: "FILL_FIELDS", payload: { answers } });
      setTabFields(tab, (prev) =>
        prev.map((f) => {
          const answer = answers.find((a) => a.fieldId === f.id);
          return answer
            ? {
                ...f,
                value: answer.value,
                filledBy,
                synced: false,
              }
            : f;
        }),
      );
    },
    [setTabFields],
  );

  const fillFields = useCallback(
    async (tab: number, targets: DetectedField[], contextUrls: string[] = []) => {
      const emptyTargets = targets.filter((f) => f.value.trim() === "");
      if (emptyTargets.length === 0) return;
      const appId = sessions[tab]?.application?.id;
      if (!appId) {
        setError("Initiate or select an application before filling with AI.");
        return;
      }
      setFilling(true);
      setError(null);
      try {
        const { answers } = await generateAnswers({
          applicationId: appId,
          fields: emptyTargets,
          contextUrls,
        });
        await applyAnswersToTab(tab, answers, "ai");
        bumpQuestionsRefresh();
      } catch (e) {
        setError(`Fill failed: ${e instanceof Error ? e.message : e}`);
      } finally {
        setFilling(false);
      }
    },
    [sessions, applyAnswersToTab, bumpQuestionsRefresh],
  );

  const fillFromMemory = useCallback(
    async (tab: number, answers: FieldAnswer[]) => {
      if (answers.length === 0) return;
      setFilling(true);
      setError(null);
      try {
        await applyAnswersToTab(tab, answers, "saved");
      } catch (e) {
        setError(`Fill failed: ${e instanceof Error ? e.message : e}`);
      } finally {
        setFilling(false);
      }
    },
    [applyAnswersToTab],
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
          setSessions((prev) => {
            const field = (prev[senderTab]?.fields ?? []).find(
              (f) => f.id === message.payload.fieldId,
            );
            if (field && field.value.trim() === "") {
              fillFields(senderTab, [field]);
            }
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
    if (!applicationId) {
      setError("Initiate or select an application before syncing.");
      return;
    }
    setSyncing(true);
    setError(null);
    try {
      const toSync = fields.filter((f) => f.value.trim() !== "");
      await syncFields(applicationId, toSync);
      setTabFields(tabId, (prev) => prev.map((f) => ({ ...f, synced: true })));
      bumpQuestionsRefresh();
    } catch (e) {
      setError(`Sync failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSyncing(false);
    }
  }, [tabId, applicationId, fields, setTabFields, bumpQuestionsRefresh]);

  return (
    <div className="flex h-screen flex-col bg-white text-sm text-gray-900">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {session && (
            <button
              onClick={goHome}
              title="Back to applications"
              className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h1 className="truncate text-base font-semibold text-violet-700">
            {session?.application
              ? `${session.application.jobTitle} — ${session.application.companyName}`
              : session
                ? "New application"
                : "Iris"}
          </h1>
        </div>
        {auth.status === "authed" && (
          <span className="truncate text-xs text-gray-500">
            {auth.user.email}
          </span>
        )}
      </header>

      <AuthGate auth={auth} onLogin={openLogin}>
        {!session ? (
          <HomeScreen
            onContinue={continueApplication}
            onOpen={openApplicationUrl}
            onNew={startNew}
          />
        ) : (
          <ApplicationScreen
            fields={fields}
            scanning={scanning}
            filling={filling}
            syncing={syncing}
            error={error}
            tabId={tabId}
            unsyncedCount={unsyncedCount}
            onScan={scan}
            onSync={sync}
            onFill={fillFields}
            onFillFromMemory={fillFromMemory}
            applicationId={applicationId}
            onApplicationCreated={handleApplicationCreated}
            onMarkedApplied={handleMarkedApplied}
            questionsRefreshKey={questionsRefreshKey}
          />
        )}
      </AuthGate>
    </div>
  );
}
