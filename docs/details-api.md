# Task details REST API

For web and mobile (Expo) clients syncing task notes.

## Data model

| Field | Storage | Description |
|-------|---------|-------------|
| `name` | `Task.name` | Plain-text task title |
| `details` | `Task.details` | HTML string — **body lines only** (no title line) |

### Unified editor HTML (web client)

The web editor renders title + body in one `contentEditable` area:

- First `.detail-line` with `data-line-type="h1"` is the **title**
- Remaining `.detail-line` elements are the **body**

On save, split with `splitEditorContent()` ([`detail-lines.ts`](../app/components/detail-lines.ts)).  
On load, merge with `buildEditorHtmlFromTask(name, details)`.

### Block types (`data-line-type`)

| Value | Meaning |
|-------|---------|
| *(omitted)* or `text` | Body paragraph |
| `h1` | Title line (first line only in editor) |
| `h2`, `h3` | Headings |
| `bullet` | Bullet list |
| `numbered` | Numbered list (`data-list-number`) |
| `checklist` | Checkbox list (`data-checked="true|false"`) |
| `code` | Code block |

### Images

Embedded in HTML as:

```html
<div class="detail-image-wrapper" contenteditable="false">
  <img src="/api/task-images/{taskId}/{filename}" ... />
</div>
```

Upload via `POST /api/tasks/{taskId}/images` (multipart field `file`).

---

## Endpoints

Base URL: your app origin (e.g. `https://app.example.com`).

All routes below support CORS (`Access-Control-Allow-Origin: *`).

### Load task

```
GET /api/tasks/{taskId}
```

Response includes `name`, `details`, due date fields, labels, etc.

### Save body

```
PUT /api/tasks/{taskId}/details
Content-Type: application/json

{ "details": "<div class=\"detail-line\">...</div>" }
```

Creates an auto version snapshot when content changed (≥30s apart, deduped).

### Save title

```
PATCH /api/tasks/{taskId}
Content-Type: application/json

{ "name": "My task title" }
```

Call when the title line changes. Body and title are separate fields.

### Upload image

```
POST /api/tasks/{taskId}/images
Content-Type: multipart/form-data

file: (binary)
```

Response: `{ "url": "/api/task-images/{taskId}/{filename}" }`

### Serve image

```
GET /api/task-images/{taskId}/{filename}
```

Returns image bytes with cache headers.

### Version history

```
GET  /api/tasks/{taskId}/versions
POST /api/tasks/{taskId}/versions          { "label"?: string }  — manual snapshot
GET  /api/tasks/{taskId}/versions/{versionId}
POST /api/tasks/{taskId}/versions/{versionId}/restore
```

---

## Recommended mobile save flow

1. Debounce edits (~2s idle).
2. `PUT /details` when body HTML changes.
3. `PATCH /tasks/{id}` with `{ name }` when title changes.
4. On app background / close: fire keepalive requests (same as web `saveTaskDetailsKeepalive` / `saveTaskNameKeepalive` in [`task-details-api.ts`](../lib/task-details-api.ts)).

---

## Auth

Routes currently have **no authentication** and open CORS. Use only on private networks or add auth before multi-tenant public deployment.

---

## Related docs

- Mobile REST (lists, tasks, labels): [`mobile-api.md`](mobile-api.md)
- Release plan: [`details-section-release-plan.md`](details-section-release-plan.md)
- v1 QA: [`v1-qa-checklist.md`](v1-qa-checklist.md)
