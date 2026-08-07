import { FileScan, RefreshCcw, Sparkles } from "lucide-react";
import type { DetectedField } from "@/lib/types";
import { FieldList } from "@/components/FieldList";
import { SyncButton } from "@/components/SyncButton";
import {
  fetchApplicationComprehensive,
  type JobApplicationComprehensiveResponse,
} from "@/services/jobs";
import { useState, useEffect } from "react";
import ResumeTab from "./ResumeTab";
import { fetchResumes, type Resume } from "@/services/resume";

interface Props {
  applicationId: string;
  fields: DetectedField[];
  scanning: boolean;
  filling: boolean;
  syncing: boolean;
  error: string | null;
  tabId: number | null;
  unsyncedCount: number;
  onScan: () => void;
  onSync: () => void;
  onFill: (tabId: number, fields: DetectedField[]) => void;
}

export default function ApplicationScreen({
  fields,
  scanning,
  filling,
  syncing,
  error,
  tabId,
  unsyncedCount,
  applicationId,
  onScan,
  onSync,
  onFill,
}: Props) {
  const [completeApplication, setCompleteApplication] =
    useState<JobApplicationComprehensiveResponse | null>(null);
  const [currentTab, setCurrentTab] = useState<"resume" | "fields">("fields");
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [isNewApplication, setIsNewApplication] = useState(true);
  const [isInitiatingApplication, setIsInitiatingApplication] = useState(false);

  useEffect(() => {
    if (applicationId == null) return;
    setIsNewApplication(false);
    fetchApplicationComprehensive(applicationId).then(setCompleteApplication);
  }, [applicationId]);

  useEffect(() => {
    fetchResumes().then(setResumes);
  }, []);

  const handleTabChange = (tab: "resume" | "fields") => {
    setCurrentTab(tab);
  };

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

  const handleInitiateApplication = () => {};

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {completeApplication && (
        <div className="p-4 max-h-64 border border-gray-200 mx-auto overflow-y-auto">
          <h2 className="text-xs font-bold mb-2 text-gray-800 uppercase">
            Job Description
          </h2>
          <p>{completeApplication?.jobDescription}</p>
        </div>
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
        </div>
      )}

      {!isNewApplication && (
        <>
          <div className="flex gap-2 w-full justify-center pt-2 px-2">
            <button
              onClick={() => handleTabChange("fields")}
              className={`${currentTab === "fields" ? "border-b-2 border-violet-600" : "border-b-2 border-gray-200"} px-3 py-1 rounded-none text-sm font-medium w-full text-center`}
            >
              Application Data
            </button>
            <button
              onClick={() => handleTabChange("resume")}
              className={`${currentTab === "resume" ? "border-b-2 border-violet-600" : "border-b-2 border-gray-200"} px-3 py-1 rounded-none text-sm font-medium w-full text-center`}
            >
              Resume
            </button>
          </div>
          {currentTab === "fields" && (
            <>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex gap-2">
                  <button
                    onClick={onScan}
                    disabled={scanning}
                    className="flex flex-1 items-center gap-2 rounded-md border border-violet-600 px-3 py-2 font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                  >
                    <FileScan className="h-4 w-4" />
                    {scanning
                      ? "Scanning…"
                      : fields.length > 0
                        ? "Rescan page"
                        : "Scan this page"}
                  </button>
                  <SyncButton
                    count={unsyncedCount}
                    syncing={syncing}
                    icon={<RefreshCcw className="h-4 w-4" />}
                    onSync={onSync}
                  />
                </div>

                {fields.length > 0 && (
                  <button
                    onClick={() => tabId != null && onFill(tabId, fields)}
                    disabled={filling}
                    className="flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
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
            </>
          )}
          {currentTab === "resume" && (
            <ResumeTab
              applicationId={applicationId || null}
              applicationResumeId={completeApplication?.resume.id ?? null}
              resumes={resumes}
              onApplicationResumeChange={handleApplicationResumeChange}
            />
          )}
        </>
      )}
    </div>
  );
}
