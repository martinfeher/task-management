import { TodoAppPage } from "./components/todo-app-page";

export default function Home() {
  return <TodoAppPage initialRoute={{ kind: "inbox" }} />;
}
