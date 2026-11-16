import { TodoAppPage } from "../components/todo-app-page";

export default function UpcomingPage() {
  return <TodoAppPage initialRoute={{ kind: "upcoming" }} />;
}
