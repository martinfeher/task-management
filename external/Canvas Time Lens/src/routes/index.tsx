import { createFileRoute } from "@tanstack/react-router";
import { DateTimePicker } from "@/components/DateTimePicker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Date & Time Picker — Refined Scheduling Popover" },
      {
        name: "description",
        content:
          "A refined date and time context menu: quick dates, month grid, time presets, duration and repeat options in one calm popover.",
      },
      { property: "og:title", content: "Date & Time Picker — Refined Scheduling Popover" },
      {
        property: "og:description",
        content:
          "A refined date and time context menu: quick dates, month grid, time presets, duration and repeat options.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background px-6 py-16">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Date &amp; time picker
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          A calmer scheduling popover: quick dates, a clean month grid, time presets with a
          scrollable slot list, duration and repeat — all in one flow.
        </p>
        <div className="mt-10 pb-[36rem]">
          <DateTimePicker />
        </div>
      </div>
    </main>
  );
}
