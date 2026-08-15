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
  is_optional?: boolean;
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

async function readApiError(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error?.trim() || null;
  } catch {
    return null;
  }
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

  if (!res.ok) {
    const apiError = await readApiError(res);
    switch (res.status) {
      case 400:
        throw new Error(apiError ?? "Invalid request — check the URL and that you have an active resume.");
      case 401:
        throw new Error("Session expired. Log in to Iris again.");
      case 403:
        throw new Error("Request blocked. Try reloading the extension.");
      case 409:
        throw new Error(apiError ?? "An application for this job already exists.");
      case 500:
        throw new Error(apiError ?? "Server failed to initiate the application. Try again.");
      default:
        throw new Error(apiError ?? `Failed to initiate application (${res.status})`);
    }
  }
  
  const body = (await res.json()) as InitiateApplicationEnvelope;
  return body.data;
}

export interface AutofillQuestionInput {
  id: string;
  question: string;
}

export interface AutofillAnsweredQuestion {
  id: string;
  question: string;
  answer: string;
}

interface AutofillEnvelope {
  data: { questions: AutofillAnsweredQuestion[] };
}

export async function autofillApplication(
  applicationId: string,
  questions: AutofillQuestionInput[],
  contextUrls: string[] = [],
): Promise<AutofillAnsweredQuestion[]> {
  const res = await fetch(`${API_URL}/extension/application/${applicationId}/autofill`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questions, contextUrls }),
  });
  if (!res.ok) {
    const apiError = await readApiError(res);
    throw new Error(apiError ?? `Autofill failed (${res.status})`);
  }
  const body = (await res.json()) as AutofillEnvelope;
  return body.data.questions;
}

export async function syncApplicationData(
  applicationId: string,
  questions: JobApplicationQuestions[],
  coverLetter?: string | null,
): Promise<void> {
  const res = await fetch(`${API_URL}/extension/application/${applicationId}/sync-data`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      questions,
      coverLetter: coverLetter ?? undefined,
    }),
  });
  if (!res.ok) {
    const apiError = await readApiError(res);
    throw new Error(apiError ?? `Sync failed (${res.status})`);
  }
}

export async function markApplicationApplied(applicationId: string): Promise<void> {
  const res = await fetch(
    `${API_URL}/extension/application/${applicationId}/mark-as-applied`,
    {
      method: "POST",
      credentials: "include",
    },
  );
  if (!res.ok) {
    const apiError = await readApiError(res);
    switch (res.status) {
      case 401:
        throw new Error("Session expired. Log in to Iris again.");
      case 409:
        throw new Error(
          apiError ?? "This application is still being filled by Iris. Wait until it finishes.",
        );
      default:
        throw new Error(apiError ?? `Failed to mark as applied (${res.status})`);
    }
  }
}
