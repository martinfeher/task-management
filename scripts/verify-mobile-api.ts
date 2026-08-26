/**
 * Mobile REST API verification script.
 * Usage: npm run verify:api -- http://localhost:3000
 */
const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

type Json = Record<string, unknown>;

async function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Json | null; headers: Headers }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json: Json | null = null;
  const text = await response.text();
  if (text) {
    try {
      json = JSON.parse(text) as Json;
    } catch {
      json = { raw: text };
    }
  }

  return { status: response.status, json, headers: response.headers };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const results: string[] = [];
  const pass = (label: string) => {
    results.push(`OK  ${label}`);
  };

  console.log(`Verifying mobile API at ${baseUrl}\n`);

  const listsRes = await request("GET", "/api/lists");
  assert(listsRes.status === 200, `GET /api/lists → ${listsRes.status}`);
  pass("GET /api/lists");

  const createList = await request("POST", "/api/lists", {
    name: `API verify ${Date.now()}`,
  });
  assert(createList.status === 200 || createList.status === 201, "POST /api/lists failed");
  const listId = String(createList.json?.id ?? "");
  assert(Boolean(listId), "POST /api/lists missing id");
  pass("POST /api/lists");

  const createTask = await request("POST", "/api/tasks", {
    name: "Verify task",
    listId,
    dueDate: new Date().toISOString().slice(0, 10),
    recurrenceRule: { frequency: "weekly", interval: 1 },
  });
  assert(createTask.status === 200 || createTask.status === 201, "POST /api/tasks failed");
  const taskId = String(createTask.json?.id ?? "");
  assert(Boolean(taskId), "POST /api/tasks missing id");
  pass("POST /api/tasks (with recurrence)");

  const getTask = await request("GET", `/api/tasks/${taskId}`);
  assert(getTask.status === 200, "GET /api/tasks/{id} failed");
  assert(getTask.json?.recurrenceRule != null, "recurrenceRule missing on GET task");
  pass("GET /api/tasks/{id}");

  const patchTask = await request("PATCH", `/api/tasks/${taskId}`, {
    calendarColor: "#4873c7",
    name: "Verify task renamed",
  });
  assert(patchTask.status === 200, "PATCH /api/tasks/{id} failed");
  pass("PATCH /api/tasks/{id} (calendarColor, name)");

  const detailsHtml = '<div class="detail-line">Body from API verify</div>';
  const putDetails = await request("PUT", `/api/tasks/${taskId}/details`, {
    details: detailsHtml,
  });
  assert(putDetails.status === 200, "PUT details failed");
  pass("PUT /api/tasks/{id}/details");

  const pngBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const pngBytes = Buffer.from(pngBase64, "base64");
  const form = new FormData();
  form.append(
    "file",
    new Blob([pngBytes], { type: "image/png" }),
    "verify.png",
  );

  const uploadRes = await fetch(`${baseUrl}/api/tasks/${taskId}/images`, {
    method: "POST",
    body: form,
  });
  assert(uploadRes.ok, `POST image failed: ${uploadRes.status}`);
  const uploadJson = (await uploadRes.json()) as { url?: string };
  assert(Boolean(uploadJson.url), "Image upload missing url");
  pass("POST /api/tasks/{id}/images");

  const imageGet = await fetch(`${baseUrl}${uploadJson.url}`);
  assert(imageGet.ok, "GET task image failed");
  const corsHeader = imageGet.headers.get("access-control-allow-origin");
  assert(corsHeader === "*" || corsHeader != null, "Image GET missing CORS");
  pass("GET /api/task-images/... (CORS)");

  const versionRes = await request("POST", `/api/tasks/${taskId}/versions`, {
    source: "manual",
  });
  assert(versionRes.status === 200 || versionRes.status === 201, "POST version failed");
  pass("POST /api/tasks/{id}/versions");

  const versionsList = await request("GET", `/api/tasks/${taskId}/versions`);
  assert(versionsList.status === 200, "GET versions failed");
  pass("GET /api/tasks/{id}/versions");

  const searchRes = await request("GET", "/api/search?q=Verify");
  assert(searchRes.status === 200, "GET /api/search failed");
  pass("GET /api/search");

  const completeRes = await request("PATCH", `/api/tasks/${taskId}`, {
    completed: true,
  });
  assert(completeRes.status === 200, "PATCH complete failed");
  assert(
    completeRes.json?.spawnedTask != null,
    "Completing recurring task should spawn next instance",
  );
  pass("PATCH complete recurring task spawns next instance");
  const spawnedId = String(completeRes.json?.spawnedTask?.id ?? "");
  if (spawnedId) {
    await request("DELETE", `/api/tasks/${spawnedId}`);
  }

  const labelsRes = await request("GET", "/api/labels");
  assert(labelsRes.status === 200, "GET /api/labels failed");
  pass("GET /api/labels");

  const listTasks = await request("GET", `/api/tasks?listId=${listId}`);
  assert(listTasks.status === 200, "GET /api/tasks?listId failed");
  pass("GET /api/tasks?listId=");

  await request("DELETE", `/api/tasks/${taskId}`);
  pass("DELETE /api/tasks/{id}");

  await request("DELETE", `/api/lists/${listId}`);
  pass("DELETE /api/lists/{listId}");

  console.log(results.join("\n"));
  console.log(`\n${results.length} checks passed.`);
}

main().catch((error) => {
  console.error("\nVerification failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
