import type { FieldAnswer } from '@/lib/messages';
import type { DetectedField } from '@/lib/types';

export interface GenerateAnswersInput {
  fields: DetectedField[];
  jobContext?: string;
}

// TODO: POST ${API_URL}/extension/fill — backend not built yet.
// Mock: returns a placeholder answer per field after a short delay.
export async function generateAnswers(input: GenerateAnswersInput): Promise<{ answers: FieldAnswer[] }> {
  await new Promise((r) => setTimeout(r, 800));
  return {
    answers: input.fields.map((f) => ({
      fieldId: f.id,
      value:
        f.kind === 'select' && f.options?.length
          ? f.options[0]
          : `[iris] mock answer for "${f.label}"`,
    })),
  };
}
