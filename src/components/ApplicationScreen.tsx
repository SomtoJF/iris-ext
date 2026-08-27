import { Sparkles } from "lucide-react";
import type { DetectedField } from "@/lib/types";
import type { FieldAnswer } from "@/lib/messages";
import {
  fetchApplicationComprehensive,
  initiateApplication,
  type JobApplicationComprehensiveResponse,
  type JobApplicationQuestions,
  type JobApplicationSummary,
} from "@/services/jobs";
import { useState, useEffect, useCallback } from "react";
import FieldsTab from "./FieldsTab";
import AnswersTab from "./AnswersTab";
import { JobDescription } from "./JobDescription";
import { DocumentPanel } from "./DocumentPanel";
import { FieldsComposer } from "./FieldsComposer";
import { fetchResumes, type Resume } from "@/services/resume";
import { cn } from "@/lib/utils";

interface Props {
  applicationId: string | null;
  fields: DetectedField[];
  scanning: boolean;
  filling: boolean;
  generatingCoverLetter: boolean;
  syncing: boolean;
  error: string | null;
  tabId: number | null;
  unsyncedCount: number;
  onScan: () => void;
  onSync: () => Promise<void>;
  onFill: (
    tabId: number,
    fields: DetectedField[],
    contextUrls: string[],
  ) => void;
  onGenerateCoverLetter: (resumeId: string | null) => void;
  onFillFromMemory: (tabId: number, answers: FieldAnswer[]) => void;
  onApplicationCreated: (app: JobApplicationSummary) => void;
  onMarkedApplied?: () => void;
  questionsRefreshKey?: number;
}

export default function ApplicationScreen({
  fields,
  scanning,
  filling,
  generatingCoverLetter,
  syncing,
  error,
  tabId,
  unsyncedCount,
  applicationId,
  onScan,
  onSync,
  onFill,
  onGenerateCoverLetter,
  onFillFromMemory,
  onApplicationCreated,
  onMarkedApplied,
  questionsRefreshKey = 0,
}: Props) {
  const [completeApplication, setCompleteApplication] =
    useState<JobApplicationComprehensiveResponse | null>(null);
  const [currentTab, setCurrentTab] = useState<"fields" | "answers">("fields");
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isInitiatingApplication, setIsInitiatingApplication] = useState(false);
  const [initiateError, setInitiateError] = useState<string | null>(null);
  const [tabsOpen, setTabsOpen] = useState(false);

  const isNewApplication = applicationId == null;
  const savedQuestions: JobApplicationQuestions[] =
    completeApplication?.questions ?? [];

  const loadComprehensive = useCallback(async (id: string) => {
    const data = await fetchApplicationComprehensive(id);
    setCompleteApplication(data);
  }, []);

  useEffect(() => {
    if (applicationId == null) {
      setCompleteApplication(null);
      return;
    }
    loadComprehensive(applicationId).catch(console.error);
  }, [applicationId, questionsRefreshKey, loadComprehensive]);

  useEffect(() => {
    fetchResumes().then(setResumes);
  }, []);

  const handleApplicationResumeChange = (resumeId: string) => {
    const resume = resumes.find((r) => r.id === resumeId);
    setCompleteApplication((prev) =>
      prev
        ? {
            ...prev,
            resume: {
              id: resumeId,
              fileName: resume?.fileName ?? prev.resume.fileName,
            },
          }
        : prev,
    );
  };

  const handleInitiateApplication = async () => {
    setIsInitiatingApplication(true);
    setInitiateError(null);
    try {
      let url: string | undefined;
      if (tabId != null) {
        const tab = await browser.tabs.get(tabId);
        url = tab.url;
      } else {
        const [tab] = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        url = tab?.url;
      }
      if (!url || !/^https?:/.test(url)) {
        throw new Error(
          "Open a job application page (http/https) before initiating.",
        );
      }

      const resumeId = resumes.find((r) => r.isActive)?.id;
      const summary = await initiateApplication({ url, resumeId });
      onApplicationCreated(summary);
    } catch (e) {
      setInitiateError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsInitiatingApplication(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {completeApplication ? (
        <div
          className={cn(
            "min-h-0 overflow-y-auto border-b border-gray-200 p-4",
            tabsOpen ? "max-h-40 shrink-0" : "flex-1",
          )}
        >
          <JobDescription markdown={completeApplication.jobDescription} />
          {completeApplication.coverLetter?.trim() ? (
            <DocumentPanel
              title="Cover Letter"
              copyText={completeApplication.coverLetter}
              className="mt-4 border-t border-gray-200 pt-4"
            >
              <p className="whitespace-pre-wrap">
                {completeApplication.coverLetter}
              </p>
            </DocumentPanel>
          ) : null}
        </div>
      ) : (
        !isNewApplication && <div className="min-h-0 flex-1" />
      )}
      {isNewApplication && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-gray-600">
            Make sure the job description is visible on the page, then start.
          </p>
          <button
            type="button"
            onClick={handleInitiateApplication}
            disabled={isInitiatingApplication}
            className="flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isInitiatingApplication ? "Initiating…" : "Initiate application"}
          </button>
          {initiateError && (
            <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">
              {initiateError}
            </p>
          )}
        </div>
      )}

      {!isNewApplication && (
        <div className="relative flex shrink-0 flex-col">
          <div className="relative z-0">
            <div
              className={cn(
                "overflow-hidden bg-white will-change-[max-height] transition-[max-height] duration-300 ease-out",
                tabsOpen ? "max-h-[min(28rem,55vh)]" : "max-h-2.5",
              )}
            >
              <div className="flex h-[min(28rem,55vh)] min-h-0 flex-col">
                <div className="flex w-full shrink-0 justify-center gap-1  bg-white px-2 pt-1">
                  {(
                    [
                      ["fields", "Application Form"],
                      ["answers", "Saved Answers"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCurrentTab(id)}
                      className={`${currentTab === id ? "border-b-2 border-violet-600" : "border-b-2 border-gray-200"} w-full rounded-none px-2 py-1 text-center text-sm font-medium`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {currentTab === "fields" && (
                  <FieldsTab
                    fields={fields}
                    scanning={scanning}
                    error={error}
                    onScan={onScan}
                  />
                )}
                {currentTab === "answers" && (
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <AnswersTab
                      questions={savedQuestions}
                      fields={fields}
                      tabId={tabId}
                      filling={filling}
                      onFillMatching={onFillFromMemory}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            aria-expanded={tabsOpen}
            aria-label={
              tabsOpen ? "Hide application data" : "Show application data"
            }
            onClick={() => setTabsOpen((open) => !open)}
            className="absolute top-0 right-3 z-20 flex h-5 -translate-y-full items-center justify-center px-3.5 text-[10px] font-medium leading-none text-gray-600 hover:text-gray-800"
          >
            <span
              aria-hidden
              className="absolute inset-0 bg-gray-200"
              style={{
                clipPath:
                  "polygon(8px 0, calc(100% - 8px) 0, 100% 100%, 0 100%)",
              }}
            />
            <span
              aria-hidden
              className="absolute inset-px bg-white"
              style={{
                clipPath:
                  "polygon(7px 0, calc(100% - 7px) 0, 100% 100%, 0 100%)",
              }}
            />
            <span className="relative whitespace-nowrap">application data</span>
          </button>

          <div className="relative z-10 bg-background shadow-[0_-6px_16px_rgba(0,0,0,0.12)]">
            <FieldsComposer
              fields={fields}
              scanning={scanning}
              filling={filling}
              generatingCoverLetter={generatingCoverLetter}
              syncing={syncing}
              tabId={tabId}
              unsyncedCount={unsyncedCount}
              applicationId={applicationId}
              applicationResumeId={completeApplication?.resume.id ?? null}
              resumes={resumes}
              onScan={onScan}
              onSync={onSync}
              onFill={onFill}
              onGenerateCoverLetter={onGenerateCoverLetter}
              onApplicationResumeChange={handleApplicationResumeChange}
              applied={completeApplication?.status === "applied"}
              onMarkedApplied={() => {
                setCompleteApplication((prev) =>
                  prev ? { ...prev, status: "applied" } : prev,
                );
                onMarkedApplied?.();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
