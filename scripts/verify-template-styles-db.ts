import "dotenv/config";
import {
  areTemplateSettingsSnapshotsEqual,
  getDefaultTemplateSettingsSnapshot,
} from "@/lib/template-settings-history";
import {
  createTemplateStyle,
  deleteTemplateStyle,
  getActiveTemplateStyleId,
  getTemplateStyleById,
  listTemplateStyles,
  setActiveTemplateStyleId,
  updateTemplateStyle,
} from "@/lib/template-style-settings";
import { prisma } from "@/lib/prisma";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const createdIds: string[] = [];

  try {
    const base = getDefaultTemplateSettingsSnapshot();
    const customSnapshot = {
      ...base,
      sidebar: { ...base.sidebar, baseColor: "#aabbcc" },
      panelTextColors: {
        ...base.panelTextColors,
        listItems: { shade: "zinc-800" as const, color: "#112233" },
      },
      tooltip: {
        ...base.tooltip,
        backgroundColor: "#222222",
        textColor: "#fefefe",
        cornerRadiusPx: 8,
      },
    };

    const created = await createTemplateStyle({
      name: "Verify DB template",
      settings: customSnapshot,
    });
    createdIds.push(created.id);

    assert(created.name === "Verify DB template", "Created style name mismatch");
    assert(
      created.settings.sidebar.baseColor === "#aabbcc",
      "Created sidebar color not persisted in response",
    );
    assert(
      created.settings.panelTextColors.listItems.color === "#112233",
      "Created panel text color not persisted in response",
    );

    const row = await prisma.templateStyle.findUnique({
      where: { id: created.id },
      select: { settingsJson: true, sidebarBaseColor: true },
    });

    assert(row?.settingsJson, "settingsJson missing in database row");
    assert(
      row?.sidebarBaseColor === "#aabbcc",
      "Legacy sidebar column not synced in database",
    );

    const settingsJson = row.settingsJson as {
      sidebar?: { baseColor?: string };
      panelTextColors?: { listItems?: { color?: string } };
    };

    assert(
      settingsJson.sidebar?.baseColor === "#aabbcc",
      "settingsJson sidebar color mismatch in database",
    );
    assert(
      settingsJson.panelTextColors?.listItems?.color === "#112233",
      "settingsJson panel text color mismatch in database",
    );

    const loaded = await getTemplateStyleById(created.id);
    assert(loaded, "Failed to load created template by id");
    assert(
      areTemplateSettingsSnapshotsEqual(loaded.settings, customSnapshot),
      "Loaded settings do not match saved snapshot",
    );

    const updatedSnapshot = {
      ...customSnapshot,
      taskList: { ...customSnapshot.taskList, baseColor: "#ddeeff" },
    };

    const updated = await updateTemplateStyle(created.id, {
      name: "Verify DB template updated",
      settings: updatedSnapshot,
    });

    assert(
      updated.settings.taskList.baseColor === "#ddeeff",
      "Updated task list color not persisted",
    );

    await setActiveTemplateStyleId(created.id);
    const activeId = await getActiveTemplateStyleId();
    assert(activeId === created.id, "Active template id not persisted");

    const listed = await listTemplateStyles();
    assert(
      listed.styles.some((style) => style.id === created.id),
      "Created template missing from list",
    );
    assert(
      listed.activeStyleId === created.id,
      "Active template id missing from list response",
    );

    console.log("PASS: template style database round-trip verified");
  } finally {
    for (const id of createdIds) {
      await deleteTemplateStyle(id).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("FAIL:", error instanceof Error ? error.message : error);
  process.exit(1);
});
