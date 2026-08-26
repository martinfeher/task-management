# Mobile REST API

REST endpoints for external clients (e.g. Expo). All JSON routes use open CORS via `jsonWithCors` — see [Auth](#auth).

Task **details** (rich HTML notes, images, versions) are documented in [`details-api.md`](details-api.md).

Base URL: your deployment origin (e.g. `https://staging.example.com`).

---

## Lists

### `GET /api/lists`

Returns all todo lists ordered by position.

```json
{ "lists": [{ "id": "…", "name": "Inbox" }] }
```

### `POST /api/lists`

Create a list.

```json
{ "name": "Shopping" }
```

### `PATCH /api/lists/{listId}`

Rename a list.

```json
{ "name": "Groceries" }
```

### `DELETE /api/lists/{listId}`

Delete a list and its tasks.

### `PUT /api/lists/reorder`

Reorder lists.

```json
{ "listIds": ["id1", "id2"] }
```

---

## Tasks

### `GET /api/tasks`

Load tasks for a view. Query params (one required):

| Param | Example | View |
|-------|---------|------|
| `listId` | `?listId=abc` | Single list (pinned + unpinned sections) |
| `view=today` | `?view=today` | Due today |
| `view=important` | `?view=important` | Important flag |
| `view=calendar` | `?view=calendar` | All scheduled incomplete tasks |
| `view=label&labelId=` | `?view=label&labelId=xyz` | Label filter |

Response:

```json
{
  "title": "Inbox",
  "pinned": [/* MobileTaskItem[] */],
  "tasks": [/* MobileTaskItem[] */]
}
```

**MobileTaskItem** fields:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `name` | string | |
| `completed` | boolean | |
| `dueDate` | ISO string \| null | |
| `dueTimeMinutes` | number \| null | 0–1439 |
| `dueDurationMinutes` | number \| null | |
| `dueTimeZone` | string | `"floating"` or IANA zone |
| `calendarColor` | string \| null | Hex color for calendar blocks |
| `recurrenceRule` | string \| null | JSON: `{"frequency":"daily\|weekly\|monthly","interval":1}` |
| `pinned` | boolean | |
| `important` | boolean | |
| `priority` | 1–3 \| null | |
| `parentId` | string \| null | Subtask parent |
| `depth` | number | Indent level in hierarchy |
| `labels` | `{ id, label }[]` | |
| `listId` | string | |
| `listName` | string | Optional on some views |

### `POST /api/tasks`

Create a task or subtask.

```json
{
  "name": "Buy milk",
  "listId": "…",
  "dueDate": "2026-08-22",
  "details": "<p>optional HTML body</p>",
  "priority": 2,
  "labelIds": ["…"],
  "parentId": null,
  "recurrenceRule": { "frequency": "weekly", "interval": 1 }
}
```

For subtasks, pass `parentId` instead of `listId`.

### `GET /api/tasks/{taskId}`

Full task record including `details`, labels, list info, recurrence, calendar color.

### `PATCH /api/tasks/{taskId}`

Partial update. Accepted fields:

- `name`, `completed`, `important`, `pinned`, `priority`
- `listId` (move task)
- `dueDate` (`YYYY-MM-DD` or null)
- `dueTimeMinutes`, `dueDurationMinutes`
- `calendarColor` (string or null)
- `recurrenceRule` (`{ frequency, interval }` or null)

### `DELETE /api/tasks/{taskId}`

Delete task (and subtasks).

### `PUT /api/tasks/reorder`

Reorder tasks within a list section.

```json
{
  "listId": "…",
  "taskIds": ["…"],
  "section": "pinned" | "unpinned"
}
```

### `PUT /api/tasks/{taskId}/labels`

Replace task labels.

```json
{ "labelIds": ["…"] }
```

---

## Labels

### `GET /api/labels`

All labels with `color`, ordered by position.

### `POST /api/labels`

```json
{ "label": "Work" }
```

### `PATCH /api/labels/{labelId}`

Rename or recolor:

```json
{ "label": "Office" }
// or
{ "color": "#ff5500" }
```

### `DELETE /api/labels/{labelId}`

### `PUT /api/labels/reorder`

```json
{ "labelIds": ["…"] }
```

---

## Search

### `GET /api/search?q=…`

Returns matching incomplete tasks across lists.

---

## Sidebar bootstrap

### `GET /api/lists` + client-side counts

Use list endpoints above; task counts for Today/Important come from `GET /api/tasks?view=today` etc.

---

## Recurrence (v1)

- Set `recurrenceRule` on create or via `PATCH`.
- When a recurring task is **completed** (web or `PATCH { completed: true }`), the server spawns the next open instance with an advanced due date.
- Completing does not auto-complete future instances.

---

## Auth

Routes have **no authentication** and open CORS. Use only on private networks or add auth before multi-tenant public deployment. See also [`details-api.md`](details-api.md#auth).

---

## Related

- Details, images, versions: [`details-api.md`](details-api.md)
- Release QA: [`v1-qa-checklist.md`](v1-qa-checklist.md)
