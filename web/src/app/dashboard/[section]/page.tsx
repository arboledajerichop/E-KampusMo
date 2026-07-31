import { notFound } from "next/navigation";
import SectionPlaceholder from "@/components/dashboard/SectionPlaceholder";

const sections = {
  reminders: {
    eyebrow: "Stay on time",
    title: "Reminders",
    description:
      "Choose when E-KampusMo should remind you about classes, deadlines, logs, and study routines.",
    icon: "bell" as const,
    features: [
      "Class and assignment reminder offsets",
      "Internship clock-out and journal reminders",
      "Allowance warnings and study-break prompts",
      "Quiet hours and offline local scheduling",
    ],
    note: "Reminder scheduling will be enabled with the notification milestone so alerts continue working offline.",
  },
};

export default async function DashboardSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const content = sections[section as keyof typeof sections];

  if (!content) {
    notFound();
  }

  return <SectionPlaceholder {...content} />;
}
