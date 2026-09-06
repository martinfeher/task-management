import { TodoAppPage } from "../components/todo-app-page";

export default function InboxPage() {
  return <TodoAppPage initialRoute={{ kind: "inbox" }} />;
}
