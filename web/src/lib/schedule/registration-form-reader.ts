"use client";

import type { ClassScheduleIdentity } from "@/lib/schedule/class-schedule-template";

export type ImportedCourseDraft = {
  id: string;
  subjectName: string;
  subjectCode: string;
  classCode: string;
  units: string;
  instructorName: string;
  dayOfWeeks: number[];
  startTime: string;
  endTime: string;
  room: string;
};

export type ParsedRegistrationForm = {
  identity: ClassScheduleIdentity;
  courses: ImportedCourseDraft[];
  rawText: string;
};

type ProgressCallback = (message: string) => void;

const DAY_TOKEN_PATTERN =
  /\b(MONDAY|MON|TUESDAY|TUES|TUE|WEDNESDAY|WEDS|WED|THURSDAY|THURS|THUR|THU|FRIDAY|FRI|SATURDAY|SAT|SUNDAY|SUN|[MTWHFSU]{1,7}|SA|SU|R)\b/gi;
const TIME_RANGE_PATTERN =
  /(\d{1,2}(?::|\.)\d{2}\s*(?:A(?:\.?M\.?)?|P(?:\.?M\.?)?)?)\s*(?:-|–|—|TO)\s*(\d{1,2}(?::|\.)\d{2}\s*(?:A(?:\.?M\.?)?|P(?:\.?M\.?)?)?)/i;
const SECTION_CODE_PATTERN =
  /\b[A-Z]{2,12}(?:-[A-Z0-9]{2,12}){2,5}\b/i;
const SUBJECT_CODE_PATTERN =
  /\b(?:[A-Z]{2,10}|[10][A-Z]{1,9})\s*-?\s*\d{1,4}[A-Z]?\b/i;

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createBlankImportedCourse(): ImportedCourseDraft {
  return {
    id: createId(),
    subjectName: "",
    subjectCode: "",
    classCode: "",
    units: "",
    instructorName: "",
    dayOfWeeks: [],
    startTime: "08:00",
    endTime: "09:00",
    room: "",
  };
}

function normalizeDocumentText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function recognizeImage(
  image: File | Blob | string,
  onProgress: ProgressCallback,
) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger(message) {
      if (message.status === "recognizing text") {
        onProgress(`Reading printed text… ${Math.round(message.progress * 100)}%`);
      }
    },
  });
  try {
    const result = await worker.recognize(image);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

async function extractPdfText(file: File, onProgress: ProgressCallback) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
  });
  const document = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    onProgress(`Extracting PDF text… page ${pageNumber} of ${document.numPages}`);
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines: Array<{
      y: number;
      items: Array<{ x: number; text: string }>;
    }> = [];
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      let line = lines.find((candidate) => Math.abs(candidate.y - y) < 2);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      }
      line.items.push({ x, text: item.str });
    }
    pageTexts.push(
      lines
        .sort((left, right) => right.y - left.y)
        .map((line) =>
          line.items
            .sort((left, right) => left.x - right.x)
            .map((item) => item.text)
            .join(" "),
        )
        .join("\n"),
    );
  }

  const nativeText = normalizeDocumentText(pageTexts.join("\n"));
  if (nativeText.replace(/\s/g, "").length >= 80) {
    return nativeText;
  }

  const ocrTexts: string[] = [];
  const pagesToRead = Math.min(document.numPages, 4);
  for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
    onProgress(`Preparing scanned PDF page ${pageNumber} of ${pagesToRead}…`);
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = window.document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) continue;
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;
    onProgress(`Reading scanned PDF page ${pageNumber} of ${pagesToRead}…`);
    ocrTexts.push(
      await recognizeImage(canvas.toDataURL("image/png"), onProgress),
    );
  }
  return normalizeDocumentText(ocrTexts.join("\n"));
}

export async function extractRegistrationFormText(
  file: File,
  onProgress: ProgressCallback,
) {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Use a registration form smaller than 15 MB.");
  }
  const lowerName = file.name.toLowerCase();
  if (
    file.type === "text/plain" ||
    file.type === "text/csv" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".csv")
  ) {
    onProgress("Reading registration text…");
    return normalizeDocumentText(await file.text());
  }
  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    return extractPdfText(file, onProgress);
  }
  if (file.type.startsWith("image/")) {
    onProgress("Preparing image recognition…");
    return normalizeDocumentText(
      await recognizeImage(file, onProgress),
    );
  }
  throw new Error("Use a PDF, PNG, JPG, TXT, or CSV registration form.");
}

function captureIdentityValue(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].replace(/\s{2,}/g, " ").trim();
  }
  return "";
}

function parseTime(value: string) {
  const normalized = value
    .toUpperCase()
    .replace(/\./g, ":")
    .replace(/\s+/g, "");
  const match = normalized.match(/^(\d{1,2}):?(\d{2})(A|AM|P|PM)?$/);
  if (!match) return "";
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return "";
  if (match[3]) {
    hour %= 12;
    if (match[3].startsWith("P")) hour += 12;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function decodeDayToken(value: string) {
  const token = value.toUpperCase();
  if (/^[MTWHFSU]+$/.test(token)) {
    const compactDays: Record<string, number> = {
      M: 1,
      T: 2,
      W: 3,
      H: 4,
      F: 5,
      S: 6,
      U: 7,
    };
    return [...new Set([...token].map((day) => compactDays[day]))].filter(
      (day): day is number => day !== undefined,
    );
  }
  const direct: Record<string, number[]> = {
    MONDAY: [1],
    MON: [1],
    M: [1],
    TUESDAY: [2],
    TUES: [2],
    TUE: [2],
    T: [2],
    WEDNESDAY: [3],
    WEDS: [3],
    WED: [3],
    W: [3],
    THURSDAY: [4],
    THURS: [4],
    THUR: [4],
    THU: [4],
    H: [4],
    R: [4],
    FRIDAY: [5],
    FRI: [5],
    F: [5],
    SATURDAY: [6],
    SAT: [6],
    SA: [6],
    S: [6],
    SUNDAY: [7],
    SUN: [7],
    SU: [7],
    U: [7],
  };
  return direct[token] ?? [];
}

function parseDays(value: string) {
  const days = new Set<number>();
  for (const match of value.matchAll(DAY_TOKEN_PATTERN)) {
    decodeDayToken(match[0]).forEach((day) => days.add(day));
  }
  return [...days].sort();
}

function normalizeSubjectCode(value: string) {
  return value
    .replace(/\s+/g, "")
    .replace(/^1(?=[A-Z]{2}\d)/i, "I")
    .replace(/^0(?=[A-Z]{2}\d)/i, "O")
    .toUpperCase();
}

function normalizeRoom(value: string) {
  const room = value
    .replace(/^[\s|,;:~_-]+|[\s|,;:~_-]+$/g, "")
    .trim();
  return /^(?:N\/?A|NIA)$/i.test(room) ? "N/A" : room;
}

function parseTabularCourseLine(
  value: string,
  timeMatch: RegExpMatchArray,
): ImportedCourseDraft | null {
  const timeStart = timeMatch.index ?? value.indexOf(timeMatch[0]);
  const beforeTime = value.slice(0, timeStart).trim();
  const afterTime = normalizeRoom(
    value.slice(timeStart + timeMatch[0].length),
  );
  const dayMatch = beforeTime.match(
    /\b(MONDAY|MON|TUESDAY|TUES|TUE|WEDNESDAY|WEDS|WED|THURSDAY|THURS|THUR|THU|FRIDAY|FRI|SATURDAY|SAT|SUNDAY|SUN|[MTWHFSU]{1,7}|SA|SU|R)\s*$/i,
  );
  if (!dayMatch) return null;

  const beforeDay = beforeTime.slice(0, dayMatch.index).trim();
  const sectionMatches = [
    ...beforeDay.matchAll(new RegExp(SECTION_CODE_PATTERN.source, "gi")),
  ];
  const sectionMatch = sectionMatches.at(-1);
  if (!sectionMatch || sectionMatch.index === undefined) return null;

  const beforeSection = beforeDay.slice(0, sectionMatch.index).trim();
  const unitsMatch = beforeSection.match(
    /\b(?:(\d{1,2}(?:\.\d{1,2})?)|([1-9])00)\s*(?:UNITS?|UNIT|U)?[\s~|,;:_-]*$/i,
  );
  if (!unitsMatch || unitsMatch.index === undefined) return null;

  const beforeUnits = beforeSection.slice(0, unitsMatch.index).trim();
  const subjectCodeMatch = beforeUnits.match(SUBJECT_CODE_PATTERN);
  if (!subjectCodeMatch || subjectCodeMatch.index === undefined) return null;
  const subjectName = beforeUnits
    .slice(subjectCodeMatch.index + subjectCodeMatch[0].length)
    .replace(/^[\s|,;:~_.-]+|[\s|,;:~_.-]+$/g, "")
    .trim();

  return {
    id: createId(),
    subjectName,
    subjectCode: normalizeSubjectCode(subjectCodeMatch[0]),
    classCode: sectionMatch[0].toUpperCase(),
    units: unitsMatch[1] ?? `${unitsMatch[2]}.00`,
    instructorName: "",
    dayOfWeeks: parseDays(dayMatch[1]),
    startTime: parseTime(timeMatch[1]) || "08:00",
    endTime: parseTime(timeMatch[2]) || "09:00",
    room: afterTime,
  };
}

function parseCourseLine(value: string): ImportedCourseDraft | null {
  const timeMatch = value.match(TIME_RANGE_PATTERN);
  if (!timeMatch) return null;
  const tabularCourse = parseTabularCourseLine(value, timeMatch);
  if (tabularCourse) return tabularCourse;

  const subjectCodeMatch = value.match(SUBJECT_CODE_PATTERN);
  const explicitClassCodeMatch = value.match(
    /\b(?:CLASS(?:\s*CODE)?|SECTION)\s*[:#-]?\s*([A-Z0-9-]{2,12})\b/i,
  );
  const classCodeCandidates = [
    ...value.matchAll(/\b[A-Z]?\d{4,8}[A-Z]?\b/gi),
  ]
    .map((match) => match[0])
    .filter(
      (candidate) =>
        !timeMatch[0].replace(/\D/g, "").includes(candidate.replace(/\D/g, "")),
    );
  const unitsMatch =
    value.match(/\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:UNITS?|UNIT|U)\b/i) ??
    value.match(/\bUNITS?\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)/i);
  const instructorMatch = value.match(
    /\b(?:PROF(?:ESSOR)?|INSTRUCTOR|FACULTY)\s*[:\-]?\s*([A-Z][A-Z .,'-]{2,}?)(?=\s+(?:ROOM|RM)\b|$)/i,
  );
  const roomMatch = value.match(
    /\b(?:ROOM|RM)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 -]{0,18}?)(?=\s+(?:PROF(?:ESSOR)?|INSTRUCTOR|FACULTY)\b|$)/i,
  );
  const dayOfWeeks = parseDays(value);
  const classCode =
    explicitClassCodeMatch?.[1] ?? classCodeCandidates[0] ?? "";

  let subjectName = value
    .replace(timeMatch[0], " ")
    .replace(DAY_TOKEN_PATTERN, " ")
    .replace(subjectCodeMatch?.[0] ?? "", " ")
    .replace(explicitClassCodeMatch?.[0] ?? classCode, " ")
    .replace(unitsMatch?.[0] ?? "", " ")
    .replace(instructorMatch?.[0] ?? "", " ")
    .replace(roomMatch?.[0] ?? "", " ")
    .replace(/\b(?:LECTURE|LABORATORY|LAB|LEC|ONLINE|HYBRID)\b/gi, " ")
    .replace(/\b(?:CLASS(?:\s*CODE)?|SECTION)\s*[:#-]?\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[|,;:\-\s]+|[|,;:\-\s]+$/g, "")
    .trim();
  if (subjectName.length > 120) subjectName = subjectName.slice(0, 120);

  return {
    id: createId(),
    subjectName,
    subjectCode: subjectCodeMatch
      ? normalizeSubjectCode(subjectCodeMatch[0])
      : "",
    classCode: classCode.toUpperCase(),
    units: unitsMatch?.[1] ?? "",
    instructorName: instructorMatch?.[1]?.trim() ?? "",
    dayOfWeeks,
    startTime: parseTime(timeMatch[1]) || "08:00",
    endTime: parseTime(timeMatch[2]) || "09:00",
    room: roomMatch?.[1]?.trim() ?? "",
  };
}

export function parseRegistrationFormText(rawText: string): ParsedRegistrationForm {
  const text = normalizeDocumentText(rawText);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const identity: ClassScheduleIdentity = {
    studentName: captureIdentityValue(text, [
      /(?:STUDENT\s*NAME|NAME\s*OF\s*STUDENT|NAME)\s*[:\-]\s*(.+?)(?=\s+(?:SCHOOL\s*YEAR|TOTAL\s*NO|GENDER|COURSE\s*NUMBER|COURSE\s*CODE)\b|\n|$)/i,
    ]),
    studentNumber: captureIdentityValue(text, [
      /(?:STUDENT\s*(?:NO\.?|NUMBER|ID)|ID\s*NUMBER)\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
    ]),
    program: captureIdentityValue(text, [
      /COURSE\s*CODE\s*:\s*DESCRIPTION\s*[:\-]\s*(.+?)(?=\s+(?:SCHOOL\s*YEAR|TOTAL\s*NO)\b|\n|$)/i,
      /(?:PROGRAM|DEGREE|COURSE)\s*[:\-]\s*([^\n]+)/i,
    ]),
    term: captureIdentityValue(text, [
      /SCHOOL\s*YEAR\s*[-–]?\s*SEMESTER\s*[:\-]\s*(\d{4}\s*-\s*[A-Z0-9]+)/i,
      /(?:TERM|SEMESTER|SCHOOL\s*YEAR|ACADEMIC\s*YEAR)\s*[:\-]\s*([^\n]+)/i,
    ]),
  };
  const courses: ImportedCourseDraft[] = [];

  lines.forEach((line, index) => {
    if (!TIME_RANGE_PATTERN.test(line)) return;
    TIME_RANGE_PATTERN.lastIndex = 0;
    let candidate = line;
    if (parseDays(candidate).length === 0) {
      candidate = [lines[index - 1], line, lines[index + 1]]
        .filter(Boolean)
        .join(" ");
    }
    const course = parseCourseLine(candidate);
    if (course) courses.push(course);
  });

  const mergedCourses: ImportedCourseDraft[] = [];
  for (const course of courses) {
    const existing = mergedCourses.find(
      (candidate) =>
        candidate.subjectCode === course.subjectCode &&
        candidate.classCode === course.classCode &&
        candidate.startTime === course.startTime &&
        candidate.endTime === course.endTime,
    );
    if (existing) {
      existing.dayOfWeeks = [
        ...new Set([...existing.dayOfWeeks, ...course.dayOfWeeks]),
      ].sort();
      if (!existing.subjectName) existing.subjectName = course.subjectName;
      if (!existing.units) existing.units = course.units;
      if (!existing.instructorName) {
        existing.instructorName = course.instructorName;
      }
      if (!existing.room) existing.room = course.room;
    } else {
      mergedCourses.push(course);
    }
  }

  return {
    identity,
    courses:
      mergedCourses.length > 0 ? mergedCourses : [createBlankImportedCourse()],
    rawText: text,
  };
}
