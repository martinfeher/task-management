import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ACTIVE_TEMPLATE_STYLE_KEY,
  getCopyTemplateName,
  normalizeTemplateStyleInput,
  serializeTemplateStyleRecord,
  templateStyleLegacyColumns,
  type TemplateStyleInput,
  type TemplateStyleRecord,
} from "@/lib/template-style-types";

export async function getActiveTemplateStyleId(
  userId: string,
): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({
    where: { userId_key: { userId, key: ACTIVE_TEMPLATE_STYLE_KEY } },
    select: { value: true },
  });

  return setting?.value || null;
}

export async function setActiveTemplateStyleId(
  userId: string,
  id: string | null,
) {
  if (!id) {
    await prisma.appSetting.deleteMany({
      where: { userId, key: ACTIVE_TEMPLATE_STYLE_KEY },
    });
    return;
  }

  await prisma.appSetting.upsert({
    where: { userId_key: { userId, key: ACTIVE_TEMPLATE_STYLE_KEY } },
    create: { userId, key: ACTIVE_TEMPLATE_STYLE_KEY, value: id },
    update: { value: id },
  });
}

export async function listTemplateStyles(userId: string): Promise<{
  styles: TemplateStyleRecord[];
  activeStyleId: string | null;
}> {
  const [records, activeStyleId] = await Promise.all([
    prisma.templateStyle.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    }),
    getActiveTemplateStyleId(userId),
  ]);

  const styles = records
    .map(serializeTemplateStyleRecord)
    .filter((style): style is TemplateStyleRecord => style !== null);

  return { styles, activeStyleId };
}

export async function getTemplateStyleById(id: string, userId: string) {
  const record = await prisma.templateStyle.findFirst({
    where: { id, userId },
  });
  if (!record) return null;
  return serializeTemplateStyleRecord(record);
}

export async function createTemplateStyle(
  input: TemplateStyleInput,
  userId: string,
) {
  const normalized = normalizeTemplateStyleInput(input);
  if (!normalized) {
    throw new Error("Invalid template style input");
  }

  const legacy = templateStyleLegacyColumns(normalized.settings);

  const record = await prisma.templateStyle.create({
    data: {
      name: normalized.name,
      settingsJson: normalized.settings as Prisma.InputJsonValue,
      userId,
      ...legacy,
    },
  });

  const style = serializeTemplateStyleRecord(record);
  if (!style) {
    throw new Error("Failed to serialize created template style");
  }

  return style;
}

export async function updateTemplateStyle(
  id: string,
  input: TemplateStyleInput,
  userId: string,
) {
  const normalized = normalizeTemplateStyleInput(input);
  if (!normalized) {
    throw new Error("Invalid template style input");
  }

  const existing = await prisma.templateStyle.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Template style not found");
  }

  const legacy = templateStyleLegacyColumns(normalized.settings);

  const record = await prisma.templateStyle.update({
    where: { id },
    data: {
      name: normalized.name,
      settingsJson: normalized.settings as Prisma.InputJsonValue,
      ...legacy,
    },
  });

  const style = serializeTemplateStyleRecord(record);
  if (!style) {
    throw new Error("Failed to serialize updated template style");
  }

  return style;
}

export async function deleteTemplateStyle(id: string, userId: string) {
  const existing = await prisma.templateStyle.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Template style not found");
  }

  const activeStyleId = await getActiveTemplateStyleId(userId);
  await prisma.templateStyle.delete({ where: { id } });

  if (activeStyleId === id) {
    await setActiveTemplateStyleId(userId, null);
  }
}

export async function copyTemplateStyle(
  id: string,
  userId: string,
  name?: string,
) {
  const source = await getTemplateStyleById(id, userId);
  if (!source) {
    throw new Error("Template style not found");
  }

  return createTemplateStyle(
    {
      name: name?.trim() ? name : getCopyTemplateName(source.name),
      settings: source.settings,
    },
    userId,
  );
}
