/**
 * Week 1 web QA gate — run with dev server at BASE_URL.
 * Usage: npm run qa:gate -- http://localhost:3000
 */
const baseUrl = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`OK  ${label}`);
  } catch (error) {
    console.error(`FAIL ${label}:`, error instanceof Error ? error.message : error);
    throw error;
  }
}

async function main() {
  console.log(`Web QA gate at ${baseUrl}\n`);

  await check("App home loads", async () => {
    const res = await fetch(baseUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });

  await check("Lists API responds", async () => {
    const res = await fetch(`${baseUrl}/api/lists`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { lists?: unknown[] };
    if (!Array.isArray(data.lists)) throw new Error("Invalid lists payload");
  });

  await check("Create task + save details + reload", async () => {
    const listRes = await fetch(`${baseUrl}/api/lists`);
    const listData = (await listRes.json()) as {
      lists: { id: string }[];
    };
    const listId = listData.lists[0]?.id;
    if (!listId) throw new Error("No list available");

    const createRes = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "QA gate task", listId }),
    });
    if (!createRes.ok) throw new Error(`Create failed ${createRes.status}`);
    const created = (await createRes.json()) as { id: string };
    const details = '<div class="detail-line">QA body</div>';

    const saveRes = await fetch(`${baseUrl}/api/tasks/${created.id}/details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ details }),
    });
    if (!saveRes.ok) throw new Error(`Save details failed ${saveRes.status}`);

    const reload = await fetch(`${baseUrl}/api/tasks/${created.id}`);
    const task = (await reload.json()) as { details?: string };
    if (task.details !== details) throw new Error("Details mismatch after reload");

    await fetch(`${baseUrl}/api/tasks/${created.id}`, { method: "DELETE" });
  });

  await check("Image upload + version restore", async () => {
    const listRes = await fetch(`${baseUrl}/api/lists`);
    const listData = (await listRes.json()) as { lists: { id: string }[] };
    const listId = listData.lists[0]?.id;
    if (!listId) throw new Error("No list available");

    const createRes = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "QA image task", listId }),
    });
    const created = (await createRes.json()) as { id: string };

    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const form = new FormData();
    form.append(
      "file",
      new Blob([Buffer.from(pngBase64, "base64")], { type: "image/png" }),
      "qa.png",
    );
    const uploadRes = await fetch(`${baseUrl}/api/tasks/${created.id}/images`, {
      method: "POST",
      body: form,
    });
    if (!uploadRes.ok) throw new Error(`Image upload failed ${uploadRes.status}`);
    const uploadJson = (await uploadRes.json()) as { url?: string };
    if (!uploadJson.url) throw new Error("Missing image url");

    const imageGet = await fetch(`${baseUrl}${uploadJson.url}`);
    if (!imageGet.ok) throw new Error("Image GET failed");

    const originalDetails = '<div class="detail-line">Original</div>';
    await fetch(`${baseUrl}/api/tasks/${created.id}/details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ details: originalDetails }),
    });

    await fetch(`${baseUrl}/api/tasks/${created.id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "manual" }),
    });

    const changedDetails = '<div class="detail-line">Changed</div>';
    await fetch(`${baseUrl}/api/tasks/${created.id}/details`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ details: changedDetails }),
    });

    const versionsRes = await fetch(`${baseUrl}/api/tasks/${created.id}/versions`);
    const versionsData = (await versionsRes.json()) as {
      versions?: { id: string }[];
    };
    const versionId = versionsData.versions?.[0]?.id;
    if (!versionId) throw new Error("No version to restore");

    const restoreRes = await fetch(
      `${baseUrl}/api/tasks/${created.id}/versions/${versionId}/restore`,
      { method: "POST" },
    );
    if (!restoreRes.ok) throw new Error(`Restore failed ${restoreRes.status}`);

    const reload = await fetch(`${baseUrl}/api/tasks/${created.id}`);
    const task = (await reload.json()) as { details?: string };
    if (task.details !== originalDetails) {
      throw new Error("Details mismatch after version restore");
    }

    await fetch(`${baseUrl}/api/tasks/${created.id}`, { method: "DELETE" });
  });

  console.log("\nWeb QA gate passed.");
}

main().catch(() => process.exit(1));
