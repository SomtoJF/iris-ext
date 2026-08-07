import { API_URL } from "@/lib/config";

export type JobApplicationStatus =
  | "processing"
  | "applied"
  | "failed"
  | "blocked"
  | "cancelled"
  | "halted" 
  | "pending";

export interface JobApplicationSummary {
  id: string;
  url: string;
  jobTitle: string;
  companyName: string;
  status: JobApplicationStatus;
  updatedAt: string;
}

interface FetchJobsEnvelope {
  data: {
    data: JobApplicationSummary[];
    total: number;
    page: number;
    limit: number;
  };
}

interface FetchApplicationComprehensiveEnvelope {
  data: JobApplicationComprehensiveResponse;
}

export interface JobApplicationQuestions {
  question: string;
  answer: string;
}

export interface ResumeSummary {
  id: string;
  fileName: string;
}

export interface JobApplicationComprehensiveResponse {
  id: string;
  url: string;
  jobTitle: string;
  companyName: string;
  status: JobApplicationStatus;
  coverLetter: string | null;
  questions: JobApplicationQuestions[] | null;
  jobDescription: string;
  resume: ResumeSummary;
}

// Non-completed applications: GET /jobs with status_not=applied
// (endpoint already excludes cover-letter-only rows).
export async function fetchIncompleteApplications(
  page = 1,
  limit = 20,
): Promise<{ applications: JobApplicationSummary[]; total: number }> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    status_not: "applied",
  });
  const res = await fetch(`${API_URL}/jobs?${params}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to fetch applications (${res.status})`);
  const body = (await res.json()) as FetchJobsEnvelope;
  return { applications: body.data.data, total: body.data.total };
}

export async function fetchApplicationComprehensive(id: string): Promise<JobApplicationComprehensiveResponse> {
  const res = await fetch(`${API_URL}/jobs/${id}/comprehensive`, {
    credentials: "include",
  });

  if (!res.ok) throw new Error(`Failed to fetch application comprehensive (${res.status})`);
  const body = (await res.json()) as FetchApplicationComprehensiveEnvelope;
  return body.data;
}

export async function patchJobApplication(
  id: string,
  { resumeId }: { resumeId: string },
): Promise<void> {
  const res = await fetch(`${API_URL}/jobs/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeId }),
  });
  if (!res.ok) throw new Error(`Failed to update job application (${res.status})`);
}

interface InitiateApplicationEnvelope {
  data: JobApplicationSummary;
}

export async function initiateApplication({
  url,
  resumeId,
}: {
  url: string;
  resumeId?: string;
}): Promise<JobApplicationSummary> {
  const res = await fetch(`${API_URL}/extension/initiate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, resumeId: resumeId ?? "" }),
  });
  if (!res.ok) throw new Error(`Failed to initiate application (${res.status})`);
  const body = (await res.json()) as InitiateApplicationEnvelope;
  return body.data;
}
