import { redirect } from "next/navigation";

type ListCalendarPageProps = {
  params: Promise<{ listId: string }>;
};

export default async function ListCalendarPage({ params }: ListCalendarPageProps) {
  const { listId } = await params;

  redirect(`/lists/${encodeURIComponent(listId)}/calendar/week`);
}
