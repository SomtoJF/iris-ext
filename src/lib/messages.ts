import type { DetectedField } from './types';

// Panel -> content script (tabs.sendMessage)
export type ContentMessage =
  | { type: 'SCAN_FIELDS' }
  | { type: 'GET_FIELDS' }
  | { type: 'FILL_FIELDS'; payload: { answers: FieldAnswer[] } };

// Content script -> panel (runtime.sendMessage)
export type RuntimeMessage =
  | { type: 'FIELDS_DETECTED'; payload: { fields: DetectedField[] } }
  | { type: 'FIELD_EDITED'; payload: { fieldId: string; value: string } }
  | { type: 'FILL_REQUESTED'; payload: { fieldId: string } }
  // Panel -> background
  | { type: 'INJECT_CONTENT'; payload: { tabId: number } };

export interface FieldAnswer {
  fieldId: string;
  value: string;
}

export interface ScanFieldsResponse {
  fields: DetectedField[];
}

export interface InjectContentResponse {
  ok: boolean;
  error?: string;
  frameIds?: number[];
}

/** Already listed in optional_host_permissions; requested at Scan time. */
export const OPTIONAL_HTTP_ORIGINS = ['http://*/*', 'https://*/*'];

export function scopeFieldId(frameId: number, localId: string): string {
  return `${frameId}:${localId}`;
}

export function unscopeFieldId(scopedId: string): { frameId: number; localId: string } {
  const sep = scopedId.indexOf(':');
  if (sep === -1) return { frameId: 0, localId: scopedId };
  const frameId = Number(scopedId.slice(0, sep));
  if (!Number.isFinite(frameId)) return { frameId: 0, localId: scopedId };
  return { frameId, localId: scopedId.slice(sep + 1) };
}

export function sendToTab<T = unknown>(
  tabId: number,
  message: ContentMessage,
  frameId?: number,
): Promise<T> {
  const options = frameId != null ? { frameId } : {};
  return browser.tabs.sendMessage(tabId, message, options) as Promise<T>;
}

export function sendToRuntime<T = unknown>(message: RuntimeMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}
