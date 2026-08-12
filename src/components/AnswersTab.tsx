import { useMemo, useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import type { DetectedField } from "@/lib/types";
import type { JobApplicationQuestions } from "@/services/jobs";
import type { FieldAnswer } from "@/lib/messages";

interface Props {
  questions: JobApplicationQuestions[];
  fields: DetectedField[];
  tabId: number | null;
  filling: boolean;
  onFillMatching: (tabId: number, answers: FieldAnswer[]) => void;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

export default function AnswersTab({
  questions,
  fields,
  tabId,
  filling,
  onFillMatching,
}: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const matchingAnswers = useMemo(() => {
    const byQuestion = new Map<string, string>();
    for (const q of questions) {
      const answer = q.answer?.trim() ?? "";
      if (!answer) continue;
      byQuestion.set(normalize(q.question), answer);
    }

    const answers: FieldAnswer[] = [];
    for (const f of fields) {
      if (f.value.trim() !== "") continue;
      const answer = byQuestion.get(normalize(f.label));
      if (answer) {
        answers.push({ fieldId: f.id, value: answer });
      }
    }
    return answers;
  }, [questions, fields]);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch (e) {
      console.error(e);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-gray-400">
        <p>No saved answers yet.</p>
        <p>Sync from Fields or fill with AI to store answers here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 p-4">
        <button
          type="button"
          onClick={() => tabId != null && onFillMatching(tabId, matchingAnswers)}
          disabled={filling || tabId == null || matchingAnswers.length === 0}
          className="flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" />
          {filling
            ? "Filling…"
            : matchingAnswers.length > 0
              ? `Fill matching fields (${matchingAnswers.length})`
              : fields.length === 0
                ? "Scan the page to fill matching fields"
                : "No matching empty fields"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <ul className="flex flex-col gap-2">
          {questions.map((q, i) => {
            const key = `${normalize(q.question)}-${i}`;
            return (
              <li key={key} className="rounded-md border border-gray-200 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-800">{q.question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-gray-500">
                      {q.answer?.trim() ? q.answer : "(empty)"}
                    </p>
                  </div>
                  {q.answer?.trim() && (
                    <button
                      type="button"
                      title="Copy answer"
                      onClick={() => handleCopy(key, q.answer)}
                      className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100"
                    >
                      {copiedKey === key ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
