import { useState } from "react";
import { patchJobApplication } from "@/services/jobs";
import type { Resume } from "@/services/resume";

interface Props {
  applicationId: string | null;
  applicationResumeId: string | null;
  resumes: Resume[];
  onApplicationResumeChange: (resumeId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export default function ResumeTab({
  applicationId,
  applicationResumeId,
  resumes,
  onApplicationResumeChange,
}: Props) {
  const [loading, setLoading] = useState(false);

  const effectiveResumeId =
    applicationResumeId ?? resumes.find((r) => r.isActive)?.id ?? null;

  async function handleSetActive(id: string) {
    if (applicationId == null) return;
    try {
      setLoading(true);
      await patchJobApplication(applicationId, { resumeId: id });
      onApplicationResumeChange(id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto px-2 pt-4">
      {resumes.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          No resumes uploaded yet
        </p>
      ) : (
        resumes.map((resume) => {
          const isSelected = resume.id === effectiveResumeId;
          return (
            <div
              key={resume.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{resume.fileName}</p>
                  {isSelected ? (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      Active
                    </span>
                  ) : (
                    <button
                      disabled={loading || applicationId == null}
                      onClick={() => handleSetActive(resume.id)}
                      className="text-xs border border-gray-300 text-gray-700 px-2 py-0.5 rounded hover:bg-gray-100 disabled:opacity-50"
                    >
                      Set Active
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {formatFileSize(resume.fileSize)}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
