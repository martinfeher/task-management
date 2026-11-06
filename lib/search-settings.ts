import { prisma } from "@/lib/prisma";

export const LAST_SEARCH_QUERY_KEY = "search.lastQuery";

export async function getLastSearchQuery(userId: string) {
  const setting = await prisma.appSetting.findUnique({
    where: { userId_key: { userId, key: LAST_SEARCH_QUERY_KEY } },
    select: { value: true },
  });

  return setting?.value ?? "";
}

export async function setLastSearchQuery(userId: string, query: string) {
  await prisma.appSetting.upsert({
    where: { userId_key: { userId, key: LAST_SEARCH_QUERY_KEY } },
    create: { userId, key: LAST_SEARCH_QUERY_KEY, value: query },
    update: { value: query },
  });
}
