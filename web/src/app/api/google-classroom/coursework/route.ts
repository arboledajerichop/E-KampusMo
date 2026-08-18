import { type NextRequest, NextResponse } from "next/server";
import {
  CLASSROOM_TOKEN_COOKIE,
  decryptGoogleClassroomToken,
  encryptGoogleClassroomToken,
  googleClassroomCookieOptions,
  isGoogleClassroomConnectionRevoked,
  isGoogleClassroomConfigured,
  loadStoredGoogleClassroomToken,
  saveStoredGoogleClassroomToken,
  refreshGoogleClassroomToken,
  type GoogleClassroomToken,
} from "@/lib/google-classroom/server";
import {
  GoogleClassroomApiError,
  googleClassroomGet,
} from "@/lib/google-classroom/request";
import {
  addRateLimitHeaders,
  checkRateLimit,
  rateLimitedJson,
  readPrivateCache,
  writePrivateCache,
} from "@/lib/security/api-protection";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const CLASSROOM_CACHE_NAMESPACE = "google-classroom-coursework";

type GoogleCourse = {
  id?: string;
  name?: string;
  section?: string;
  courseState?: string;
  creationTime?: string;
};

type GoogleCourseWork = {
  id?: string;
  courseId?: string;
  title?: string;
  description?: string;
  alternateLink?: string;
  workType?: string;
  maxPoints?: number;
  creationTime?: string;
  dueDate?: {
    year?: number;
    month?: number;
    day?: number;
  };
  dueTime?: {
    hours?: number;
    minutes?: number;
    seconds?: number;
  };
};

type GoogleAnnouncement = {
  id?: string;
  courseId?: string;
  text?: string;
  alternateLink?: string;
  creationTime?: string;
  updateTime?: string;
  state?: string;
};

type CoursesResponse = {
  courses?: GoogleCourse[];
  nextPageToken?: string;
};

type CourseWorkResponse = {
  courseWork?: GoogleCourseWork[];
  nextPageToken?: string;
};

type AnnouncementsResponse = {
  announcements?: GoogleAnnouncement[];
  nextPageToken?: string;
};

type GoogleStudentSubmission = {
  courseWorkId?: string;
  state?: string;
  late?: boolean;
};

type StudentSubmissionsResponse = {
  studentSubmissions?: GoogleStudentSubmission[];
  nextPageToken?: string;
};

class GoogleClassroomReconnectError extends Error {}

function dueAt(courseWork: GoogleCourseWork) {
  const date = courseWork.dueDate;
  if (!date?.year || !date.month || !date.day) return null;

  const time = courseWork.dueTime;
  if (!time) {
    return new Date(
      Date.UTC(date.year, date.month - 1, date.day, 15, 59),
    ).toISOString();
  }
  return new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day,
      time.hours ?? 0,
      time.minutes ?? 0,
      time.seconds ?? 0,
    ),
  ).toISOString();
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in.", code: "unauthorized" },
      { status: 401 },
    );
  }

  if (!isGoogleClassroomConfigured()) {
    return NextResponse.json(
      {
        error: "Google Classroom has not been configured for this app.",
        code: "not-configured",
      },
      { status: 503 },
    );
  }

  const cookieToken = decryptGoogleClassroomToken(
    request.cookies.get(CLASSROOM_TOKEN_COOKIE)?.value,
  );
  let token = cookieToken?.userId === user.id ? cookieToken : null;
  try {
    const revoked = await isGoogleClassroomConnectionRevoked(supabase, user.id);
    if (revoked) {
      token = null;
    } else {
      const storedToken = await loadStoredGoogleClassroomToken(user.id);
      if (storedToken) token = storedToken;
      else if (token) await saveStoredGoogleClassroomToken(token);
    }
  } catch {
    // Keep using the encrypted browser cookie when the optional account
    // connection table is unavailable.
  }
  if (!token) {
    return NextResponse.json(
      {
        error: "Connect Google Classroom before loading coursework.",
        code: "not-connected",
      },
      { status: 401 },
    );
  }

  const rateLimit = await checkRateLimit(
    supabase,
    user.id,
    "classroom-coursework",
  );
  if (!rateLimit.allowed) {
    return rateLimitedJson(
      rateLimit,
      "Google Classroom was refreshed too often. Please wait a moment before trying again.",
    );
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  if (!forceRefresh) {
    const cached = readPrivateCache<{
      courses: Array<{
        id: string;
        name: string;
        section: string;
        courseState: "ACTIVE" | "ARCHIVED";
        creationTime: string | null;
      }>;
      courseWork: Array<{
        id: string;
        courseId: string;
        courseName: string;
        title: string;
        description: string;
        alternateLink: string;
        workType: string;
        maxPoints: number | null;
        dueAt: string | null;
        creationTime: string | null;
        courseState: "ACTIVE" | "ARCHIVED";
        submissionState: string | null;
        late: boolean;
      }>;
      announcements?: Array<{
        id: string;
        courseId: string;
        courseName: string;
        text: string;
        alternateLink: string;
        creationTime: string | null;
        updateTime: string | null;
      }>;
      limited: boolean;
    }>(CLASSROOM_CACHE_NAMESPACE, user.id);
    if (cached) {
      const cachedValue = {
        ...cached.value,
        announcements: cached.value.announcements ?? [],
      };
      return addRateLimitHeaders(
        NextResponse.json(cachedValue, {
          headers: {
            "Cache-Control":
              "private, max-age=30, stale-while-revalidate=120",
            Vary: "Cookie",
            Age: String(cached.ageSeconds),
            "X-EKampusMo-Cache": "HIT",
          },
        }),
        rateLimit,
      );
    }
  }

  let tokenChanged = false;

  async function refreshToken() {
    if (!token) throw new GoogleClassroomReconnectError();
    try {
      token = await refreshGoogleClassroomToken(token);
      tokenChanged = true;
    } catch {
      throw new GoogleClassroomReconnectError();
    }
  }

  async function googleGet<T>(url: URL): Promise<T> {
    if (!token) throw new GoogleClassroomReconnectError();
    return googleClassroomGet<T>({
      url,
      getAccessToken: () => {
        if (!token) throw new GoogleClassroomReconnectError();
        return token.accessToken;
      },
      refreshAccessToken: refreshToken,
    });
  }

  try {
    if (token.expiresAt <= Date.now() + 60_000) {
      await refreshToken();
    }

    const courses: Array<{
      id: string;
      name: string;
      section: string;
      courseState: "ACTIVE" | "ARCHIVED";
      creationTime: string | null;
    }> = [];
    let nextCoursePage: string | undefined;
    let coursePages = 0;
    do {
      const url = new URL(
        "https://classroom.googleapis.com/v1/courses",
      );
      url.searchParams.set("studentId", "me");
      url.searchParams.append("courseStates", "ACTIVE");
      url.searchParams.append("courseStates", "ARCHIVED");
      url.searchParams.set("pageSize", "100");
      url.searchParams.set(
        "fields",
        "courses(id,name,section,courseState,creationTime),nextPageToken",
      );
      if (nextCoursePage) {
        url.searchParams.set("pageToken", nextCoursePage);
      }

      const result = await googleGet<CoursesResponse>(url);
      for (const course of result.courses ?? []) {
        if (course.id && course.name) {
          courses.push({
            id: course.id,
            name: course.name,
            section: course.section ?? "",
            courseState:
              course.courseState === "ARCHIVED" ? "ARCHIVED" : "ACTIVE",
            creationTime: course.creationTime ?? null,
          });
        }
      }
      nextCoursePage = result.nextPageToken;
      coursePages += 1;
    } while (nextCoursePage && coursePages < 5);

    const courseWork: Array<{
      id: string;
      courseId: string;
      courseName: string;
      title: string;
      description: string;
      alternateLink: string;
      workType: string;
      maxPoints: number | null;
      dueAt: string | null;
      creationTime: string | null;
      courseState: "ACTIVE" | "ARCHIVED";
      submissionState: string | null;
      late: boolean;
    }> = [];
    const announcements: Array<{
      id: string;
      courseId: string;
      courseName: string;
      text: string;
      alternateLink: string;
      creationTime: string | null;
      updateTime: string | null;
    }> = [];
    let limited = Boolean(nextCoursePage);

    const submissionsByCourse = new Map<
      string,
      Map<string, GoogleStudentSubmission>
    >();
    for (const course of courses) {
      const submissionsByCourseWork = new Map<
        string,
        GoogleStudentSubmission
      >();
      let nextSubmissionPage: string | undefined;
      let submissionPages = 0;
      do {
          const url = new URL(
            `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(
              course.id,
            )}/courseWork/-/studentSubmissions`,
          );
          url.searchParams.set("userId", "me");
          url.searchParams.set("pageSize", "100");
          url.searchParams.set(
            "fields",
            "studentSubmissions(courseWorkId,state,late),nextPageToken",
          );
          if (nextSubmissionPage) {
            url.searchParams.set("pageToken", nextSubmissionPage);
          }

        const result = await googleGet<StudentSubmissionsResponse>(url);
        for (const submission of result.studentSubmissions ?? []) {
          if (submission.courseWorkId) {
            submissionsByCourseWork.set(
              submission.courseWorkId,
              submission,
            );
          }
        }
        nextSubmissionPage = result.nextPageToken;
        submissionPages += 1;
      } while (nextSubmissionPage && submissionPages < 5);
      if (nextSubmissionPage) limited = true;
      submissionsByCourse.set(course.id, submissionsByCourseWork);
    }

    for (const course of courses) {
      const submissionsByCourseWork =
        submissionsByCourse.get(course.id) ??
        new Map<string, GoogleStudentSubmission>();

      await Promise.all([
        (async () => {
          let nextWorkPage: string | undefined;
          let workPages = 0;
          do {
        const url = new URL(
          `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(
            course.id,
          )}/courseWork`,
        );
        url.searchParams.append("courseWorkStates", "PUBLISHED");
        url.searchParams.set("orderBy", "updateTime desc");
        url.searchParams.set("pageSize", "100");
        url.searchParams.set(
          "fields",
          "courseWork(id,title,description,alternateLink,workType,maxPoints,creationTime,dueDate,dueTime),nextPageToken",
        );
        if (nextWorkPage) {
          url.searchParams.set("pageToken", nextWorkPage);
        }

            const result = await googleGet<CourseWorkResponse>(url);
            for (const item of result.courseWork ?? []) {
              if (!item.id || !item.title) continue;
              const submission = submissionsByCourseWork.get(item.id);
              courseWork.push({
                id: item.id,
                courseId: course.id,
                courseName: course.name,
                title: item.title,
                description: item.description ?? "",
                alternateLink: item.alternateLink ?? "",
                workType: item.workType ?? "COURSE_WORK_TYPE_UNSPECIFIED",
                maxPoints:
                  typeof item.maxPoints === "number"
                    ? item.maxPoints
                    : null,
                dueAt: dueAt(item),
                creationTime: item.creationTime ?? null,
                courseState: course.courseState,
                submissionState: submission?.state ?? null,
                late: submission?.late ?? false,
              });
            }
            nextWorkPage = result.nextPageToken;
            workPages += 1;
          } while (nextWorkPage && workPages < 2);
          limited ||= Boolean(nextWorkPage);
        })(),

        // Announcements were introduced after the original Classroom
        // integration. They are optional: an account authorized before that
        // addition does not have this scope, so a 403 here must not prevent
        // the user's assignments from loading.
        (async () => {
          try {
          let nextAnnouncementPage: string | undefined;
          let announcementPages = 0;
          do {
        const url = new URL(
          `https://classroom.googleapis.com/v1/courses/${encodeURIComponent(
            course.id,
          )}/announcements`,
        );
        url.searchParams.set("announcementStates", "PUBLISHED");
        url.searchParams.set("orderBy", "updateTime desc");
        url.searchParams.set("pageSize", "100");
        url.searchParams.set(
          "fields",
          "announcements(id,courseId,text,alternateLink,creationTime,updateTime,state),nextPageToken",
        );
        if (nextAnnouncementPage) {
          url.searchParams.set("pageToken", nextAnnouncementPage);
        }

            const result = await googleGet<AnnouncementsResponse>(url);
            for (const announcement of result.announcements ?? []) {
              if (!announcement.id || announcement.state === "DELETED") continue;
              announcements.push({
                id: announcement.id,
                courseId: announcement.courseId ?? course.id,
                courseName: course.name,
                text: announcement.text ?? "",
                alternateLink: announcement.alternateLink ?? "",
                creationTime: announcement.creationTime ?? null,
                updateTime: announcement.updateTime ?? null,
              });
            }
            nextAnnouncementPage = result.nextPageToken;
            announcementPages += 1;
          } while (nextAnnouncementPage && announcementPages < 2);
          limited ||= Boolean(nextAnnouncementPage);
          } catch (error) {
            if (error instanceof GoogleClassroomReconnectError) {
              throw error;
            }
          }
        })(),
      ]);
    }

    const now = Date.now();
    courseWork.sort((left, right) => {
      const leftTime = left.dueAt
        ? new Date(left.dueAt).getTime()
        : Number.POSITIVE_INFINITY;
      const rightTime = right.dueAt
        ? new Date(right.dueAt).getTime()
        : Number.POSITIVE_INFINITY;
      const leftUpcoming = leftTime >= now;
      const rightUpcoming = rightTime >= now;

      if (leftUpcoming !== rightUpcoming) {
        return leftUpcoming ? -1 : 1;
      }
      if (!leftUpcoming && !rightUpcoming) {
        return rightTime - leftTime;
      }
      return leftTime - rightTime;
    });
    announcements.sort((left, right) => {
      const leftTime = new Date(
        left.updateTime ?? left.creationTime ?? 0,
      ).getTime();
      const rightTime = new Date(
        right.updateTime ?? right.creationTime ?? 0,
      ).getTime();
      return rightTime - leftTime;
    });

    const payload = { courses, courseWork, announcements, limited };
    writePrivateCache(
      CLASSROOM_CACHE_NAMESPACE,
      user.id,
      payload,
      120,
    );
    const response = NextResponse.json(
      payload,
      {
        headers: {
          "Cache-Control":
            "private, max-age=30, stale-while-revalidate=120",
          Vary: "Cookie",
          "X-EKampusMo-Cache": "MISS",
        },
      },
    );
    if (tokenChanged) {
      try {
        await saveStoredGoogleClassroomToken(token as GoogleClassroomToken);
      } catch {
        // The refreshed cookie below still keeps this browser connected.
      }
      response.cookies.set(
        CLASSROOM_TOKEN_COOKIE,
        encryptGoogleClassroomToken(token as GoogleClassroomToken),
        googleClassroomCookieOptions(request, 30 * 24 * 60 * 60),
      );
    }
    return addRateLimitHeaders(response, rateLimit);
  } catch (error) {
    if (error instanceof GoogleClassroomReconnectError) {
      const response = NextResponse.json(
        {
          error: "Google Classroom needs to be connected again.",
          code: "reconnect",
        },
        { status: 401 },
      );
      response.cookies.set(
        CLASSROOM_TOKEN_COOKIE,
        "",
        googleClassroomCookieOptions(request, 0),
      );
      return addRateLimitHeaders(response, rateLimit);
    }

    const message =
      error instanceof GoogleClassroomApiError
        ? error.message
        : "Google Classroom could not be reached. Please try again.";
    const status =
      error instanceof GoogleClassroomApiError &&
      error.status === 403
        ? 403
        : 502;
    return addRateLimitHeaders(
      NextResponse.json(
        { error: message, code: "google-api-error" },
        { status },
      ),
      rateLimit,
    );
  }
}
