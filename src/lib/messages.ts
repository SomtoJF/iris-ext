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

export function sendToTab<T = unknown>(tabId: number, message: ContentMessage): Promise<T> {
  return browser.tabs.sendMessage(tabId, message) as Promise<T>;
}

export function sendToRuntime<T = unknown>(message: RuntimeMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}
