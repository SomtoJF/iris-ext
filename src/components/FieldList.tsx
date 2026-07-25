import type { DetectedField } from '@/lib/types';

const badgeStyles: Record<DetectedField['filledBy'], string> = {
  none: 'bg-gray-100 text-gray-500',
  ai: 'bg-violet-100 text-violet-700',
  user: 'bg-amber-100 text-amber-700',
};

export function FieldList({ fields }: { fields: DetectedField[] }) {
  if (fields.length === 0) {
    return <p className="text-center text-xs text-gray-400">No fields detected yet. Scan the page to start.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {fields.map((f) => (
        <li key={f.id} className="rounded-md border border-gray-200 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium">{f.label}</span>
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeStyles[f.filledBy]}`}>
              {f.filledBy === 'none' ? f.kind : f.filledBy}
            </span>
          </div>
          {f.value && <p className="mt-1 truncate text-xs text-gray-500">{f.value}</p>}
        </li>
      ))}
    </ul>
  );
}
