import { prisma } from "@/lib/prisma";
import {
  ACTIVE_TEMPLATE_STYLE_KEY,
  getCopyTemplateName,
  normalizeTemplateStyleInput,
  serializeTemplateStyleRecord,
  type TemplateStyleInput,
  type TemplateStyleRecord,
} from "@/lib/template-style-types";

export async function getActiveTemplateStyleId(): Promise<string | null> {
  const setting = await prisma.appSetting.findUnique({
    where: { key: ACTIVE_TEMPLATE_STYLE_KEY },
    select: { value: true },
  });

  return setting?.value || null;
}

export async function setActiveTemplateStyleId(id: string | null) {
  if (!id) {
    await prisma.appSetting.deleteMany({
      where: { key: ACTIVE_TEMPLATE_STYLE_KEY },
    });
    return;
  }

  await prisma.appSetting.upsert({
    where: { key: ACTIVE_TEMPLATE_STYLE_KEY },
    create: { key: ACTIVE_TEMPLATE_STYLE_KEY, value: id },
    update: { value: id },
  });
}

export async function listTemplateStyles(): Promise<{
  styles: TemplateStyleRecord[];
  activeStyleId: string | null;
}> {
  const [records, activeStyleId] = await Promise.all([
    prisma.templateStyle.findMany({
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    }),
    getActiveTemplateStyleId(),
  ]);

  const styles = records
    .map(serializeTemplateStyleRecord)
    .filter((style): style is TemplateStyleRecord => style !== null);

  return { styles, activeStyleId };
}

export async function getTemplateStyleById(id: string) {
  const record = await prisma.templateStyle.findUnique({ where: { id } });
  if (!record) return null;
  return serializeTemplateStyleRecord(record);
}

export async function createTemplateStyle(input: TemplateStyleInput) {
  const normalized = normalizeTemplateStyleInput(input);
  if (!normalized) {
    throw new Error("Invalid template style input");
  }

  const record = await prisma.templateStyle.create({
    data: normalized,
  });

  const style = serializeTemplateStyleRecord(record);
  if (!style) {
    throw new Error("Failed to serialize created template style");
  }

  return style;
}

export async function updateTemplateStyle(id: string, input: TemplateStyleInput) {
  const normalized = normalizeTemplateStyleInput(input);
  if (!normalized) {
    throw new Error("Invalid template style input");
  }

  const record = await prisma.templateStyle.update({
    where: { id },
    data: normalized,
  });

  const style = serializeTemplateStyleRecord(record);
  if (!style) {
    throw new Error("Failed to serialize updated template style");
  }

  return style;
}

export async function deleteTemplateStyle(id: string) {
  const activeStyleId = await getActiveTemplateStyleId();
  await prisma.templateStyle.delete({ where: { id } });

  if (activeStyleId === id) {
    await setActiveTemplateStyleId(null);
  }
}

export async function copyTemplateStyle(id: string, name?: string) {
  const source = await getTemplateStyleById(id);
  if (!source) {
    throw new Error("Template style not found");
  }

  return createTemplateStyle({
    name: name?.trim() ? name : getCopyTemplateName(source.name),
    sidebarBackgroundId: source.sidebarBackgroundId,
    sidebarBaseColor: source.sidebarBaseColor,
    calendarBackgroundId: source.calendarBackgroundId,
    calendarBaseColor: source.calendarBaseColor,
    calendarEndColor: source.calendarEndColor,
    calendarTitleColor: source.calendarTitleColor,
    calendarTimeColor: source.calendarTimeColor,
  });
}
