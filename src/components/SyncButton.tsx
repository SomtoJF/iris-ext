interface Props {
  count: number;
  syncing: boolean;
  onSync: () => void;
}

export function SyncButton({ count, syncing, onSync }: Props) {
  if (count === 0) return null;
  return (
    <button
      onClick={onSync}
      disabled={syncing}
      className="relative rounded-md border border-amber-500 px-3 py-2 font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
    >
      {syncing ? 'Syncing…' : 'Sync'}
      <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
        {count}
      </span>
    </button>
  );
}
