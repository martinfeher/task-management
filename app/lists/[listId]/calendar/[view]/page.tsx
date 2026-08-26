import { TodoAppPage } from "../../../../components/todo-app-page";
import {
  clampListCalendarMultiDayCount,
  clampListCalendarMultiWeekCount,
  parseListCalendarView,
} from "@/lib/todo-routes";
import { redirect } from "next/navigation";

type ListCalendarViewPageProps = {
  params: Promise<{ listId: string; view: string }>;
  searchParams: Promise<{ n?: string }>;
};

export default async function ListCalendarViewPage({
  params,
  searchParams,
}: ListCalendarViewPageProps) {
  const { listId, view } = await params;
  const { n } = await searchParams;
  const calendarView = parseListCalendarView(view);

  if (!calendarView) {
    redirect(`/lists/${encodeURIComponent(listId)}/calendar/week`);
  }

  if (calendarView === "days") {
    return (
      <TodoAppPage
        initialRoute={{
          kind: "listCalendar",
          listId,
          calendarView,
          multiDayCount: clampListCalendarMultiDayCount(n),
        }}
      />
    );
  }

  if (calendarView === "weeks") {
    return (
      <TodoAppPage
        initialRoute={{
          kind: "listCalendar",
          listId,
          calendarView,
          multiWeekCount: clampListCalendarMultiWeekCount(n),
        }}
      />
    );
  }

  return (
    <TodoAppPage initialRoute={{ kind: "listCalendar", listId, calendarView }} />
  );
}
