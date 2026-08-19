import { API_URL } from "@/lib/config";

interface ResumeEnvelope {
  data: Resume[];
}

export interface Resume {
  id: string;
  displayName: string;
  fileName: string;
  fileSize: number;
  fileKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function fetchResumes(): Promise<Resume[]> {
  const res = await fetch(`${API_URL}/resumes`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to fetch resumes (${res.status})`);
  const body = (await res.json()) as ResumeEnvelope;
  return body.data;
}

export async function setResumeAsActive(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/resumes/${id}/activate`, {
    method: "PUT",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to set resume as active (${res.status})`);
}
