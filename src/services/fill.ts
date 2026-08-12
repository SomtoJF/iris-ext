import type { FieldAnswer } from '@/lib/messages';
import type { DetectedField } from '@/lib/types';
import { autofillApplication } from '@/services/jobs';

export interface GenerateAnswersInput {
  applicationId: string;
  fields: DetectedField[];
  contextUrls?: string[];
}

export async function generateAnswers(
  input: GenerateAnswersInput,
): Promise<{ answers: FieldAnswer[] }> {
  if (!input.applicationId) {
    throw new Error('No application selected');
  }
  const emptyFields = input.fields.filter((f) => f.value.trim() === '');
  if (emptyFields.length === 0) {
    return { answers: [] };
  }

  const questions = await autofillApplication(
    input.applicationId,
    emptyFields.map((f) => ({ id: f.id, question: f.label })),
    input.contextUrls ?? [],
  );

  return {
    answers: questions
      .filter((q) => q.answer.trim() !== '')
      .map((q) => ({
        fieldId: q.id,
        value: q.answer,
      })),
  };
}
