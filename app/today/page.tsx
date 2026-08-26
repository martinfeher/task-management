import { TodoAppPage } from "../components/todo-app-page";

export default function TodayPage() {
  return <TodoAppPage initialRoute={{ kind: "today" }} />;
}
