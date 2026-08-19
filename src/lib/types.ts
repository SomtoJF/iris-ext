export type FieldKind = 'text' | 'textarea' | 'select';

export interface DetectedField {
  id: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  value: string;
  filledBy: 'none' | 'ai' | 'user' | 'saved';
  synced: boolean;
  /** Native required / aria-required when known; null if unknown. */
  required: boolean | null;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthed' }
  | { status: 'authed'; user: User };
