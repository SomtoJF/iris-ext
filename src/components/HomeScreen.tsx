import { useEffect, useState } from "react";
import { CirclePlus } from "lucide-react";
import type { JobApplicationSummary } from "@/services/jobs";
import { fetchIncompleteApplications } from "@/services/jobs";

const statusStyles: Record<string, string> = {
  processing: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  blocked: "bg-orange-100 text-orange-700",
  cancelled: "bg-gray-100 text-gray-500",
  halted: "bg-amber-100 text-amber-700",
};

interface Props {
  onContinue: (app: JobApplicationSummary) => void;
  onNew: () => void;
}

export function HomeScreen({ onContinue, onNew }: Props) {
  const [applications, setApplications] = useState<JobApplicationSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIncompleteApplications()
      .then(({ applications }) => setApplications(applications))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
      <button
        onClick={onNew}
        className="flex items-center justify-center gap-2 rounded-md bg-violet-600 px-3 py-2 font-medium text-white hover:bg-violet-700"
      >
        <CirclePlus className="h-4 w-4" />
        New application
      </button>

      <h2 className="mt-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Unfinished applications
      </h2>

      {error && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      {applications == null && !error && <p className="text-center text-xs text-gray-400">Loading…</p>}
      {applications?.length === 0 && (
        <p className="text-center text-xs text-gray-400">Nothing unfinished. Start a new application.</p>
      )}

      <ul className="flex flex-col gap-2">
        {applications?.map((app) => (
          <li key={app.id}>
            <button
              onClick={() => onContinue(app)}
              className="w-full rounded-md border border-gray-200 p-3 text-left hover:border-violet-400 hover:bg-violet-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium">{app.jobTitle}</span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusStyles[app.status] ?? "bg-gray-100 text-gray-500"}`}
                >
                  {app.status}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-gray-500">{app.companyName}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
