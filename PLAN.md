# Iris Chrome Extension — Plan

## Concept

Chrome extension (Manifest V3) for AI-assisted job applications. User activates the extension on an application page; fill buttons appear above text inputs, and a side panel offers a "complete application" button. Unlike the autonomous worker (which stays), the user's real browser session does the navigating — no captchas, bot detection, or login walls, and no screenshots/vision model. Real DOM text + resume → text completion. Human reviews before submitting.

## Architecture

```
content script (DOM) ⇄ side panel (UI) → iris-api (new endpoints) → temporal worker (new workflow) → LLM
                                              ⇅
                                          DB (application field state)
```

- **Extension repo**: iris-ext (this repo).
- **API**: extension talks to iris-api; a few new endpoints needed.
- **Worker**: new Temporal workflow for extension-assisted applications; autonomous JobApplicationWorkflow unchanged.

## Extension UI

- **Side panel** (`chrome.sidePanel`): extension UI. Holds "complete application" button, sync button, login state. Lives beside the page — no CSS/z-index conflicts, survives navigation.
- **Content script**: reads the DOM, paints per-field "fill with iris" buttons above inputs, writes answers into fields, detects manual edits (`input`/`change` events). Talks to panel via `chrome.runtime` messaging.
- Start with plain text inputs / textareas / selects. Exotic widgets (Workday/Greenhouse custom dropdowns, typeaheads, iframes, file uploads): fallback = show suggested answer to copy.

## Fill flow

- One API shape for both buttons: `{fields: [{label, type, options?, surrounding_context}], job_context, id_resume}` → `{answers}`. Per-field fill = 1-element call; "complete application" = batched call (batching keeps answers consistent).
- Every fill request that hits the worker pulls the application's stored field state from DB first, so the LLM sees previously filled/edited fields and stays consistent.
- Reuse the worker's answer-generation prompts + resume-context assembly (the "what to write" half, not the planner's "what to click" half).

## Sync (manual edits)

- User edits a field manually → sync button appears in the side panel.
- Clicking sync persists current field state to the DB (signal into the workflow → sqldb activity).
- Nice-to-have: badge the sync button with unsynced-change count (content script already sees the edit events).

## Temporal workflow (new)

- One workflow per application, started with **update-with-start** keyed on `id_job_application`.
- Fill request = Temporal **update handler**, returns answers synchronously to the API call.
- Sync = **signal**, persists field state via existing sqldb activity pattern.
- Completes on submit / abandon / timeout.
- Reuse existing activities (UpdateJobApplication, llm) where they fit (per iris-worker CLAUDE.md).

## Data model

- Reuse existing `job_application_data` table (iris-worker `activity/sqldb/jobapplicationdata.go`): `Questions` jsonb of `{question, answer}` per application, plus `CoverLetter`.
- Add optional `source: ai|user` to `JobApplicationQuestion` (additive; lenient Scan keeps old rows valid).
- Add upsert/update activity — only `CreateJobApplicationData` exists today; sync + repeated fills need update-in-place keyed on `id_job_application`.

## Auth

- Reuse client session cookie: extension fetches with `credentials: include`; API CORS must allow `chrome-extension://<id>` origin; cookie must be `SameSite=None; Secure`.
- On 401, panel shows "log in" button that opens the iris-client login page in a tab.

## Future

- Answers users accept/edit = training data for the autonomous worker's question-answering.

## Decisions

- Fill endpoint: one plain HTTP request/response (all answers in one API call; no streaming).
- Field state: reuse `job_application_data` (see Data model).
