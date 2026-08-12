import { FileScan, RefreshCcw, Sparkles } from "lucide-react";
import type { DetectedField } from "@/lib/types";
import { FieldList } from "@/components/FieldList";
import { SyncButton } from "@/components/SyncButton";

interface Props {
  fields: DetectedField[];
  scanning: boolean;
  filling: boolean;
  syncing: boolean;
  error: string | null;
  tabId: number | null;
  unsyncedCount: number;
  onScan: () => void;
  onSync: () => void;
  onFill: (tabId: number, fields: DetectedField[]) => void;
}

export default function FieldsTab({
  fields,
  scanning,
  filling,
  syncing,
  error,
  tabId,
  unsyncedCount,
  onScan,
  onSync,
  onFill,
}: Props) {
  return (
    <>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex gap-2">
          <button
            onClick={onScan}
            disabled={scanning}
            className="flex flex-1 items-center gap-2 rounded-md border border-violet-600 px-3 py-2 font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
          >
            <FileScan className="h-4 w-4" />
            {scanning
              ? "Scanning…"
              : fields.length > 0
                ? "Rescan page"
                : "Scan this page"}
          </button>
          <SyncButton
            count={unsyncedCount}
            syncing={syncing}
            icon={<RefreshCcw className="h-4 w-4" />}
            onSync={onSync}
          />
        </div>

        {fields.length > 0 && (
          <button
            onClick={() => tabId != null && onFill(tabId, fields)}
            disabled={filling}
            className="flex items-center gap-2 rounded-md bg-violet-600 px-3 py-2 font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {filling ? "Filling…" : "Autofill all fields"}
          </button>
        )}

        {error && (
          <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">
            {error}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <FieldList fields={fields} />
      </div>
    </>
  );
}
