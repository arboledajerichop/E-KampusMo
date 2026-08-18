import assert from "node:assert/strict";
import test from "node:test";
import {
  getUniqueScheduleMeetings,
  scheduleMeetingKey,
} from "../src/lib/schedule/schedule-meetings.ts";

const baseMeeting = {
  subjectId: "subject-1",
  dayOfWeek: 1,
  startTime: "07:30",
  endTime: "10:30",
  meetingType: "lecture",
  room: "ITC-111",
  building: "",
  campus: "",
  mode: "face-to-face",
  meetingLink: "",
};

test("uses the same key for exact registration-import duplicates", () => {
  assert.equal(
    scheduleMeetingKey(baseMeeting),
    scheduleMeetingKey({ ...baseMeeting, room: "  itc-111 " }),
  );
});

test("keeps one exact meeting while preserving a distinct day", () => {
  const unique = getUniqueScheduleMeetings([
    baseMeeting,
    { ...baseMeeting, room: "ITC-111" },
    { ...baseMeeting, dayOfWeek: 3 },
  ]);

  assert.equal(unique.length, 2);
  assert.deepEqual(
    unique.map((meeting) => meeting.dayOfWeek),
    [1, 3],
  );
});
