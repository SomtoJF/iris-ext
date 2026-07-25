import type { DetectedField } from '@/lib/types';

// TODO: POST ${API_URL}/extension/sync — persists field state to job_application_data.
// Mock: pretends the sync succeeded.
export async function syncFields(fields: DetectedField[]): Promise<{ ok: true }> {
  void fields;
  await new Promise((r) => setTimeout(r, 500));
  return { ok: true };
}
