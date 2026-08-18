export type ScheduleMeetingLike = {
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  meetingType: string;
  room: string;
  building: string;
  campus: string;
  mode: string;
  meetingLink: string;
};

function normalizedValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function scheduleMeetingKey(meeting: ScheduleMeetingLike) {
  return [
    meeting.subjectId,
    meeting.dayOfWeek,
    meeting.startTime,
    meeting.endTime,
    normalizedValue(meeting.meetingType),
    normalizedValue(meeting.room),
    normalizedValue(meeting.building),
    normalizedValue(meeting.campus),
    normalizedValue(meeting.mode),
    normalizedValue(meeting.meetingLink),
  ].join("|");
}

export function getUniqueScheduleMeetings<T extends ScheduleMeetingLike>(
  meetings: T[],
) {
  const seen = new Set<string>();
  return meetings.filter((meeting) => {
    const key = scheduleMeetingKey(meeting);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
