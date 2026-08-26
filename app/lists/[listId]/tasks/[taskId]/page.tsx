import { redirect } from "next/navigation";

type LegacyListTaskPageProps = {
  params: Promise<{ listId: string; taskId: string }>;
};

export default async function LegacyListTaskPage({
  params,
}: LegacyListTaskPageProps) {
  const { taskId } = await params;

  redirect(`/tasks/${encodeURIComponent(taskId)}`);
}
