import type { ReactNode } from 'react';
import type { AuthState } from '@/lib/types';

interface Props {
  auth: AuthState;
  onLogin: () => void;
  children: ReactNode;
}

export function AuthGate({ auth, onLogin, children }: Props) {
  if (auth.status === 'loading') {
    return <p className="p-4 text-center text-gray-500">Loading…</p>;
  }
  if (auth.status === 'unauthed') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-gray-600">Log in to Iris to fill applications with AI.</p>
        <button
          onClick={onLogin}
          className="rounded-md bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-700"
        >
          Log in to Iris
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
