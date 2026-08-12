import type { DetectedField } from '@/lib/types';
import { syncApplicationData, type JobApplicationQuestions } from '@/services/jobs';

function isOptional(field: DetectedField): boolean {
  if (field.required === true) return false;
  if (field.required === false) return true;
  return false;
}

export async function syncFields(
  applicationId: string,
  fields: DetectedField[],
): Promise<{ ok: true }> {
  if (!applicationId) {
    throw new Error('No application selected');
  }

  const questions: JobApplicationQuestions[] = fields
    .filter((f) => f.value.trim() !== '')
    .map((f) => ({
      question: f.label,
      answer: f.value,
      is_optional: isOptional(f),
    }));

  if (questions.length === 0) {
    return { ok: true };
  }

  await syncApplicationData(applicationId, questions);
  return { ok: true };
}
