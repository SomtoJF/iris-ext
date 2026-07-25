import type { ContentMessage, FieldAnswer } from '@/lib/messages';
import { sendToRuntime } from '@/lib/messages';
import type { DetectedField, FieldKind } from '@/lib/types';

type FillableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const IRIS_ID_ATTR = 'data-iris-id';
const INPUT_SELECTOR = [
  'input:not([type])',
  'input[type="text"]',
  'input[type="email"]',
  'input[type="tel"]',
  'input[type="url"]',
  'input[type="number"]',
  'textarea',
  'select',
].join(', ');

export default defineContentScript({
  registration: 'runtime',
  main() {
    const w = window as typeof window & { __irisInjected?: boolean };
    if (w.__irisInjected) return;
    w.__irisInjected = true;

    const elements = new Map<string, FillableElement>();
    let programmaticWrite = false;
    let overlay: HTMLElement | null = null;
    let repositionQueued = false;

    // ----- scanning -----

    function isVisible(el: HTMLElement): boolean {
      if (el.hidden || (el as FillableElement).disabled) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = getComputedStyle(el);
      return style.visibility !== 'hidden' && style.display !== 'none';
    }

    function kindOf(el: FillableElement): FieldKind {
      if (el instanceof HTMLTextAreaElement) return 'textarea';
      if (el instanceof HTMLSelectElement) return 'select';
      return 'text';
    }

    function labelFor(el: FillableElement): string {
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label?.textContent?.trim()) return label.textContent.trim();
      }
      const wrapping = el.closest('label');
      if (wrapping?.textContent?.trim()) return wrapping.textContent.trim();
      const aria = el.getAttribute('aria-label');
      if (aria?.trim()) return aria.trim();
      const labelledBy = el.getAttribute('aria-labelledby');
      if (labelledBy) {
        const text = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
          .filter(Boolean)
          .join(' ');
        if (text) return text;
      }
      const placeholder = el.getAttribute('placeholder');
      if (placeholder?.trim()) return placeholder.trim();
      const prev = el.previousElementSibling;
      if (prev?.textContent?.trim()) return prev.textContent.trim();
      return el.name || 'Unlabeled field';
    }

    function scan(): DetectedField[] {
      removeOverlay();
      elements.clear();
      const fields: DetectedField[] = [];
      document.querySelectorAll<FillableElement>(INPUT_SELECTOR).forEach((el, i) => {
        if (!isVisible(el)) return;
        const id = `iris-${i}-${el.name || el.id || kindOf(el)}`;
        el.setAttribute(IRIS_ID_ATTR, id);
        elements.set(id, el);
        fields.push({
          id,
          label: labelFor(el).slice(0, 200),
          kind: kindOf(el),
          options:
            el instanceof HTMLSelectElement
              ? Array.from(el.options).map((o) => o.text.trim())
              : undefined,
          value: el.value,
          filledBy: 'none',
          synced: true,
        });
      });
      paintOverlay();
      return fields;
    }

    // ----- fill buttons overlay (single host, shadow DOM avoids page CSS) -----

    function removeOverlay() {
      overlay?.remove();
      overlay = null;
    }

    function paintOverlay() {
      removeOverlay();
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute;top:0;left:0;z-index:2147483647;';
      const shadow = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        button {
          position: absolute;
          transform: translateY(-100%);
          font: 600 11px/1 system-ui, sans-serif;
          color: #fff;
          background: #6d28d9;
          border: none;
          border-radius: 4px 4px 0 0;
          padding: 3px 8px;
          cursor: pointer;
        }
        button:hover { background: #5b21b6; }
      `;
      shadow.appendChild(style);
      for (const id of elements.keys()) {
        const btn = document.createElement('button');
        btn.textContent = 'Fill with iris';
        btn.dataset.fieldId = id;
        btn.addEventListener('click', () => sendToRuntime({ type: 'FILL_REQUESTED', payload: { fieldId: id } }));
        shadow.appendChild(btn);
      }
      document.body.appendChild(host);
      overlay = host;
      position();
    }

    function position() {
      if (!overlay) return;
      for (const btn of overlay.shadowRoot!.querySelectorAll<HTMLButtonElement>('button')) {
        const el = elements.get(btn.dataset.fieldId!);
        if (!el || !isVisible(el)) {
          btn.style.display = 'none';
          continue;
        }
        const rect = el.getBoundingClientRect();
        btn.style.display = '';
        btn.style.left = `${rect.left + window.scrollX}px`;
        btn.style.top = `${rect.top + window.scrollY}px`;
      }
    }

    function queueReposition() {
      if (repositionQueued) return;
      repositionQueued = true;
      requestAnimationFrame(() => {
        repositionQueued = false;
        position();
      });
    }

    window.addEventListener('scroll', queueReposition, { passive: true, capture: true });
    window.addEventListener('resize', queueReposition, { passive: true });

    // ----- writing answers -----

    function setNativeValue(el: FillableElement, value: string) {
      const proto =
        el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : el instanceof HTMLSelectElement
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter ? setter.call(el, value) : (el.value = value);
    }

    function fill(answers: FieldAnswer[]) {
      programmaticWrite = true;
      try {
        for (const { fieldId, value } of answers) {
          const el = elements.get(fieldId);
          if (!el) continue;
          if (el instanceof HTMLSelectElement) {
            const opt = Array.from(el.options).find((o) => o.text.trim() === value || o.value === value);
            if (opt) setNativeValue(el, opt.value);
          } else {
            setNativeValue(el, value);
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } finally {
        programmaticWrite = false;
      }
    }

    // ----- manual edit watcher -----

    function onEdit(e: Event) {
      if (programmaticWrite) return;
      const target = e.target as HTMLElement | null;
      const id = target?.getAttribute?.(IRIS_ID_ATTR);
      if (!id) return;
      sendToRuntime({
        type: 'FIELD_EDITED',
        payload: { fieldId: id, value: (target as FillableElement).value },
      });
    }

    document.addEventListener('input', onEdit, true);
    document.addEventListener('change', onEdit, true);

    // ----- messaging -----

    browser.runtime.onMessage.addListener((message: ContentMessage, _sender, sendResponse) => {
      switch (message.type) {
        case 'SCAN_FIELDS':
        case 'GET_FIELDS':
          sendResponse({ fields: scan() });
          return;
        case 'FILL_FIELDS':
          fill(message.payload.answers);
          sendResponse({ ok: true });
          return;
      }
    });
  },
});
