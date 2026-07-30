import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const CLASSROOM_TOKEN_COOKIE = "ekampusmo-google-classroom";
export const CLASSROOM_STATE_COOKIE = "ekampusmo-google-classroom-state";
export const CLASSROOM_VERIFIER_COOKIE =
  "ekampusmo-google-classroom-verifier";

export const GOOGLE_CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
] as const;

export type GoogleClassroomToken = {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
};

type GoogleClassroomConfig = {
  clientId: string;
  clientSecret: string;
  tokenSecret: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function readConfig(): GoogleClassroomConfig | null {
  const clientId = process.env.GOOGLE_CLASSROOM_CLIENT_ID?.trim() ?? "";
  const clientSecret =
    process.env.GOOGLE_CLASSROOM_CLIENT_SECRET?.trim() ?? "";
  const tokenSecret =
    process.env.GOOGLE_CLASSROOM_TOKEN_SECRET?.trim() ?? "";

  if (!clientId || !clientSecret || tokenSecret.length < 32) {
    return null;
  }

  return { clientId, clientSecret, tokenSecret };
}

export function isGoogleClassroomConfigured() {
  return readConfig() !== null;
}

function requireConfig() {
  const config = readConfig();
  if (!config) {
    throw new Error("Google Classroom is not configured.");
  }
  return config;
}

export function getGoogleClassroomRedirectUri(request: Request) {
  const configuredRedirect =
    process.env.GOOGLE_CLASSROOM_REDIRECT_URI?.trim();
  if (configuredRedirect) return configuredRedirect;

  return `${new URL(request.url).origin}/api/google-classroom/callback`;
}

export function googleClassroomCookieOptions(
  request: Request,
  maxAge: number,
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge,
  };
}

export function createGoogleClassroomState() {
  return randomBytes(32).toString("base64url");
}

export function createPkceVerifier() {
  return randomBytes(48).toString("base64url");
}

export function createPkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

function tokenEncryptionKey() {
  return createHash("sha256")
    .update(requireConfig().tokenSecret)
    .digest();
}

export function encryptGoogleClassroomToken(
  token: GoogleClassroomToken,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(token), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptGoogleClassroomToken(
  value: string | undefined,
): GoogleClassroomToken | null {
  if (!value) return null;

  try {
    const [version, ivValue, tagValue, encryptedValue] = value.split(".");
    if (
      version !== "v1" ||
      !ivValue ||
      !tagValue ||
      !encryptedValue
    ) {
      return null;
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      tokenEncryptionKey(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]);
    const parsed = JSON.parse(decrypted.toString("utf8")) as Partial<
      GoogleClassroomToken
    >;

    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.accessToken !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      accessToken: parsed.accessToken,
      refreshToken:
        typeof parsed.refreshToken === "string"
          ? parsed.refreshToken
          : null,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

async function requestGoogleToken(
  parameters: URLSearchParams,
): Promise<GoogleTokenResponse> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: parameters,
    cache: "no-store",
  });
  const result = (await response.json()) as GoogleTokenResponse;

  if (!response.ok || !result.access_token) {
    throw new Error(
      result.error_description ||
        result.error ||
        "Google did not return an access token.",
    );
  }

  return result;
}

export async function exchangeGoogleClassroomCode({
  code,
  verifier,
  redirectUri,
  userId,
}: {
  code: string;
  verifier: string;
  redirectUri: string;
  userId: string;
}): Promise<GoogleClassroomToken> {
  const config = requireConfig();
  const result = await requestGoogleToken(
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: verifier,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  );

  return {
    userId,
    accessToken: result.access_token!,
    refreshToken: result.refresh_token ?? null,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  };
}

export async function refreshGoogleClassroomToken(
  current: GoogleClassroomToken,
): Promise<GoogleClassroomToken> {
  if (!current.refreshToken) {
    throw new Error("Google Classroom needs to be connected again.");
  }

  const config = requireConfig();
  const result = await requestGoogleToken(
    new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: current.refreshToken,
      grant_type: "refresh_token",
    }),
  );

  return {
    userId: current.userId,
    accessToken: result.access_token!,
    refreshToken: result.refresh_token ?? current.refreshToken,
    expiresAt: Date.now() + (result.expires_in ?? 3600) * 1000,
  };
}

export function googleClassroomAuthorizationUrl({
  request,
  state,
  challenge,
}: {
  request: Request;
  state: string;
  challenge: string;
}) {
  const config = requireConfig();
  const parameters = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getGoogleClassroomRedirectUri(request),
    response_type: "code",
    access_type: "offline",
    prompt: "consent select_account",
    include_granted_scopes: "true",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: GOOGLE_CLASSROOM_SCOPES.join(" "),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${parameters.toString()}`;
}
