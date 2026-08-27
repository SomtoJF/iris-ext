import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldAnswer, RuntimeMessage, ScanFieldsResponse } from "@/lib/messages";
import { sendToRuntime, sendToTab } from "@/lib/messages";
import type { AuthState, DetectedField } from "@/lib/types";
import { getMe, openLogin } from "@/services/auth";
import { generateAnswers } from "@/services/fill";
import { syncFields } from "@/services/sync";
import {
  fetchApplicationComprehensive,
  generateCoverLetter,
  type JobApplicationSummary,
} from "@/services/jobs";
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
const COVER_LETTER_POLL_MS = 3000;
const COVER_LETTER_TIMEOUT_MS = 3 * 60 * 1000;
const COVER_LETTER_FIELD = /cover\s*letter/i;
const SYNC_DEBOUNCE_MS = 3000;

function isHttpUrl(url: string): boolean {
  return /^https?:/.test(url);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [tabId, setTabId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionsByTab>({});
  const [scanning, setScanning] = useState(false);
  const [filling, setFilling] = useState(false);
  const [generatingCoverLetter, setGeneratingCoverLetter] = useState(false);
  const [syncingTabs, setSyncingTabs] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [questionsRefreshKey, setQuestionsRefreshKey] = useState(0);
  const hydrated = useRef(false);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const syncTimersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {},
  );

  const session = tabId != null ? sessions[tabId] : undefined;
  const fields = session?.fields ?? [];
  const applicationId = session?.application?.id ?? null;
  const unsyncedCount = fields.filter((f) => !f.synced).length;
  const syncing = tabId != null && syncingTabs.has(tabId);

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
    const onRemoved = (id: number) => {
      const timer = syncTimersRef.current[id];
      if (timer) {
        clearTimeout(timer);
        delete syncTimersRef.current[id];
      }
      setSessions((prev) => {
        const { [id]: _dropped, ...rest } = prev;
        return rest;
      });
    };
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
    const timer = syncTimersRef.current[tabId];
    if (timer) {
      clearTimeout(timer);
      delete syncTimersRef.current[tabId];
    }
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
                synced: true,
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

  const handleGenerateCoverLetter = useCallback(
    async (resumeId: string | null) => {
      const appId = applicationId;
      if (!appId) {
        setError("Initiate or select an application before generating a cover letter.");
        return;
      }
      const tab = tabId;
      setGeneratingCoverLetter(true);
      setError(null);
      try {
        await generateCoverLetter(appId, { resumeId });
        const started = Date.now();
        while (true) {
          if (Date.now() - started > COVER_LETTER_TIMEOUT_MS) {
            throw new Error("Cover letter generation timed out. Try again.");
          }
          await sleep(COVER_LETTER_POLL_MS);
          const data = await fetchApplicationComprehensive(appId);
          if (data.coverLetterStatus === "failed") {
            throw new Error("Cover letter generation failed.");
          }
          if (data.coverLetterStatus === "ready") {
            const body = data.coverLetter?.trim() ?? "";
            if (body && tab != null) {
              const field = (sessionsRef.current[tab]?.fields ?? []).find(
                (f) =>
                  COVER_LETTER_FIELD.test(f.label) && f.value.trim() === "",
              );
              if (field) {
                await applyAnswersToTab(
                  tab,
                  [{ fieldId: field.id, value: body }],
                  "ai",
                );
              }
            }
            bumpQuestionsRefresh();
            break;
          }
        }
      } catch (e) {
        setError(
          `Cover letter failed: ${e instanceof Error ? e.message : e}`,
        );
      } finally {
        setGeneratingCoverLetter(false);
      }
    },
    [applicationId, tabId, applyAnswersToTab, bumpQuestionsRefresh],
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

  const runSync = useCallback(
    async (tab: number) => {
      const s = sessionsRef.current[tab];
      const appId = s?.application?.id;
      if (!appId || !s) return;
      if (s.application?.status === "applied") return;

      const toSync = s.fields.filter(
        (f) => f.filledBy === "user" && !f.synced && f.value.trim() !== "",
      );
      if (toSync.length === 0) return;

      setSyncingTabs((prev) => {
        const next = new Set(prev);
        next.add(tab);
        return next;
      });
      setError(null);
      try {
        await syncFields(appId, toSync);
        setTabFields(tab, (prev) =>
          prev.map((f) => {
            const sent = toSync.find((item) => item.id === f.id);
            if (sent && sent.value === f.value) return { ...f, synced: true };
            return f;
          }),
        );
        bumpQuestionsRefresh();
      } catch (e) {
        setError(`Sync failed: ${e instanceof Error ? e.message : e}`);
        throw e;
      } finally {
        setSyncingTabs((prev) => {
          const next = new Set(prev);
          next.delete(tab);
          return next;
        });
      }
    },
    [setTabFields, bumpQuestionsRefresh],
  );

  const scheduleSync = useCallback(
    (tab: number) => {
      const existing = syncTimersRef.current[tab];
      if (existing) clearTimeout(existing);
      syncTimersRef.current[tab] = setTimeout(() => {
        delete syncTimersRef.current[tab];
        void runSync(tab).catch(() => {});
      }, SYNC_DEBOUNCE_MS);
    },
    [runSync],
  );

  const flushSync = useCallback(async () => {
    if (tabId == null) return;
    const existing = syncTimersRef.current[tabId];
    if (existing) {
      clearTimeout(existing);
      delete syncTimersRef.current[tabId];
    }
    await runSync(tabId);
  }, [tabId, runSync]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(syncTimersRef.current)) {
        clearTimeout(timer);
      }
      syncTimersRef.current = {};
    };
  }, []);

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
          scheduleSync(senderTab);
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
  }, [setTabFields, fillFields, scheduleSync]);

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
            generatingCoverLetter={generatingCoverLetter}
            syncing={syncing}
            error={error}
            tabId={tabId}
            unsyncedCount={unsyncedCount}
            onScan={scan}
            onSync={flushSync}
            onFill={fillFields}
            onGenerateCoverLetter={handleGenerateCoverLetter}
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
