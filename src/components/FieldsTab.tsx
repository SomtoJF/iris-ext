import { FileScan } from "lucide-react";
import type { DetectedField } from "@/lib/types";
import type { Resume } from "@/services/resume";
import { FieldList } from "@/components/FieldList";
import { FieldsComposer } from "@/components/FieldsComposer";

interface Props {
  fields: DetectedField[];
  scanning: boolean;
  filling: boolean;
  generatingCoverLetter: boolean;
  syncing: boolean;
  error: string | null;
  tabId: number | null;
  unsyncedCount: number;
  applicationId: string | null;
  applicationResumeId: string | null;
  resumes: Resume[];
  onScan: () => void;
  onSync: () => Promise<void>;
  onFill: (tabId: number, fields: DetectedField[], contextUrls: string[]) => void;
  onGenerateCoverLetter: (resumeId: string | null) => void;
  onApplicationResumeChange: (resumeId: string) => void;
  applied?: boolean;
  onMarkedApplied?: () => void;
}

export default function FieldsTab({
  fields,
  scanning,
  filling,
  generatingCoverLetter,
  syncing,
  error,
  tabId,
  unsyncedCount,
  applicationId,
  applicationResumeId,
  resumes,
  onScan,
  onSync,
  onFill,
  onGenerateCoverLetter,
  onApplicationResumeChange,
  applied,
  onMarkedApplied,
}: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {error && (
        <p className="mx-4 mt-3 rounded-md bg-red-50 p-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {fields.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Scan this page to detect application fields.
            </p>
            <button
              type="button"
              onClick={onScan}
              disabled={scanning}
              className="flex items-center gap-2 rounded-md border border-violet-600 px-3 py-2 font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              <FileScan className="h-4 w-4" />
              {scanning ? "Scanning…" : "Scan this page"}
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <FieldList fields={fields} />
          </div>
        )}
      </div>

      <FieldsComposer
        fields={fields}
        scanning={scanning}
        filling={filling}
        generatingCoverLetter={generatingCoverLetter}
        syncing={syncing}
        tabId={tabId}
        unsyncedCount={unsyncedCount}
        applicationId={applicationId}
        applicationResumeId={applicationResumeId}
        resumes={resumes}
        onScan={onScan}
        onSync={onSync}
        onFill={onFill}
        onGenerateCoverLetter={onGenerateCoverLetter}
        onApplicationResumeChange={onApplicationResumeChange}
        applied={applied}
        onMarkedApplied={onMarkedApplied}
      />
    </div>
  );
}
