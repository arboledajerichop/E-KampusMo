import assert from "node:assert/strict";
import test from "node:test";
import {
  GoogleClassroomApiError,
  googleClassroomGet,
} from "../src/lib/google-classroom/request.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("retries a temporary Google service failure", async () => {
  let calls = 0;
  const result = await googleClassroomGet<{ value: string }>({
    url: new URL("https://classroom.googleapis.com/v1/courses"),
    getAccessToken: () => "token",
    refreshAccessToken: async () => {},
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? jsonResponse(503, { error: { message: "The service is currently unavailable." } })
        : jsonResponse(200, { value: "loaded" });
    },
    wait: async () => {},
  });

  assert.equal(calls, 2);
  assert.equal(result.value, "loaded");
});

test("does not retry a permanent Google permission error", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      googleClassroomGet({
        url: new URL("https://classroom.googleapis.com/v1/courses"),
        getAccessToken: () => "token",
        refreshAccessToken: async () => {},
        fetchImpl: async () => {
          calls += 1;
          return jsonResponse(403, { error: { message: "Permission denied." } });
        },
        wait: async () => {},
      }),
    (error: unknown) =>
      error instanceof GoogleClassroomApiError && error.status === 403,
  );
  assert.equal(calls, 1);
});

test("refreshes an expired token before continuing", async () => {
  let accessToken = "expired";
  let refreshes = 0;
  const result = await googleClassroomGet<{ value: string }>({
    url: new URL("https://classroom.googleapis.com/v1/courses"),
    getAccessToken: () => accessToken,
    refreshAccessToken: async () => {
      refreshes += 1;
      accessToken = "fresh";
    },
    fetchImpl: async (_url, init) =>
      String(new Headers(init?.headers).get("Authorization")) === "Bearer expired"
        ? jsonResponse(401, { error: { message: "Expired." } })
        : jsonResponse(200, { value: "loaded" }),
    wait: async () => {},
  });

  assert.equal(refreshes, 1);
  assert.equal(result.value, "loaded");
});
