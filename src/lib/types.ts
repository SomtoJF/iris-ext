export type FieldKind = 'text' | 'textarea' | 'select';

export interface DetectedField {
  id: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  value: string;
  filledBy: 'none' | 'ai' | 'user';
  synced: boolean;
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
