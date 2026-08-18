const GOOGLE_RETRY_DELAYS_MS = [300, 900] as const;

export class GoogleClassroomApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type GoogleClassroomRequestOptions = {
  url: URL;
  getAccessToken: () => string;
  refreshAccessToken: () => Promise<void>;
  fetchImpl?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
};

function googleErrorMessage(value: unknown, fallback: string) {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    value.error &&
    typeof value.error === "object" &&
    "message" in value.error &&
    typeof value.error.message === "string"
  ) {
    return value.error.message;
  }
  return fallback;
}

function isTemporaryGoogleFailure(status: number) {
  return status === 429 || status >= 500;
}

function pause(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function googleClassroomGet<T>({
  url,
  getAccessToken,
  refreshAccessToken,
  fetchImpl = fetch,
  wait = pause,
}: GoogleClassroomRequestOptions): Promise<T> {
  for (
    let attempt = 0;
    attempt <= GOOGLE_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      let response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        cache: "no-store",
      });

      if (response.status === 401) {
        await refreshAccessToken();
        response = await fetchImpl(url, {
          headers: { Authorization: `Bearer ${getAccessToken()}` },
          cache: "no-store",
        });
      }

      const result = (await response.json()) as unknown;
      if (response.ok) return result as T;

      const error = new GoogleClassroomApiError(
        response.status,
        googleErrorMessage(
          result,
          "Google Classroom could not return this information.",
        ),
      );
      if (
        !isTemporaryGoogleFailure(error.status) ||
        attempt === GOOGLE_RETRY_DELAYS_MS.length
      ) {
        throw error;
      }
    } catch (error) {
      if (
        (error instanceof GoogleClassroomApiError &&
          !isTemporaryGoogleFailure(error.status)) ||
        attempt === GOOGLE_RETRY_DELAYS_MS.length
      ) {
        throw error;
      }
    }

    await wait(GOOGLE_RETRY_DELAYS_MS[attempt]!);
  }

  throw new Error("Google Classroom request exhausted its retries.");
}
