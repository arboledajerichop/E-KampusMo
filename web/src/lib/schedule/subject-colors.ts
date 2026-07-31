import type { Subject } from "@/lib/offline/academic-store";

export type SubjectPastel = {
  accent: string;
  surface: string;
  border: string;
  text: string;
};

export const subjectPastels: SubjectPastel[] = [
  { accent: "#6f8fd8", surface: "#edf2ff", border: "#cfdbfa", text: "#294779" },
  { accent: "#ce7f9b", surface: "#fff0f5", border: "#f4d1dd", text: "#7b3650" },
  { accent: "#64a486", surface: "#eaf8f1", border: "#c7e8d7", text: "#286247" },
  { accent: "#c38b4e", surface: "#fff5e8", border: "#f1dabd", text: "#75471f" },
  { accent: "#9274c7", surface: "#f4efff", border: "#ded1f6", text: "#513780" },
  { accent: "#4e9eaf", surface: "#eaf8fb", border: "#c6e7ed", text: "#24616d" },
  { accent: "#b87967", surface: "#fff0eb", border: "#efd1c7", text: "#743f31" },
  { accent: "#7e9d52", surface: "#f2f8e8", border: "#d8e7bd", text: "#486426" },
  { accent: "#c174ae", surface: "#fff0fb", border: "#edcfea", text: "#713766" },
  { accent: "#5b91c8", surface: "#edf6ff", border: "#cce0f3", text: "#295982" },
  { accent: "#a98b45", surface: "#fff8df", border: "#eadcae", text: "#685321" },
  { accent: "#778ea5", surface: "#eef4f8", border: "#d2dfe8", text: "#3b5368" },
];

function courseKey(subject: Pick<Subject, "id" | "code" | "name">) {
  const code = subject.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const name = subject.name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code || name || subject.id;
}

export function getSubjectPastel(
  subject: Subject | undefined,
  subjects: Subject[],
): SubjectPastel {
  if (!subject) return subjectPastels[0];

  const keys: string[] = [];
  for (const item of subjects) {
    const key = courseKey(item);
    if (!keys.includes(key)) keys.push(key);
  }

  const index = Math.max(0, keys.indexOf(courseKey(subject)));
  if (index < subjectPastels.length) return subjectPastels[index];

  const hue = Math.round((index * 137.508) % 360);
  return {
    accent: `hsl(${hue} 38% 56%)`,
    surface: `hsl(${hue} 60% 96%)`,
    border: `hsl(${hue} 42% 84%)`,
    text: `hsl(${hue} 42% 30%)`,
  };
}
