import { TodoAppPage } from "../../components/todo-app-page";
import {
  clampListCalendarMultiDayCount,
  clampListCalendarMultiWeekCount,
  parseListCalendarView,
} from "@/lib/todo-routes";
import { redirect } from "next/navigation";

type CalendarViewPageProps = {
  params: Promise<{ view: string }>;
  searchParams: Promise<{ n?: string }>;
};

export default async function CalendarViewPage({
  params,
  searchParams,
}: CalendarViewPageProps) {
  const { view } = await params;
  const { n } = await searchParams;
  const calendarView = parseListCalendarView(view);

  if (!calendarView) {
    redirect("/calendar/week");
  }

  if (calendarView === "days") {
    return (
      <TodoAppPage
        initialRoute={{
          kind: "calendar",
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
          kind: "calendar",
          calendarView,
          multiWeekCount: clampListCalendarMultiWeekCount(n),
        }}
      />
    );
  }

  return (
    <TodoAppPage initialRoute={{ kind: "calendar", calendarView }} />
  );
}
