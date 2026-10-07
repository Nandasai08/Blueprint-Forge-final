export type SupabaseIdentity = {
  id: string;
  email: string | null;
};

export type ProfileIdentity = SupabaseIdentity & {
  role: "admin" | "municipal_officer" | "department_officer" | "viewer";
  department: string | null;
  full_name: string | null;
};

export class CivicServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode = 500,
    readonly code?: string,
    readonly technicalDetails?: string,
  ) {
    super(message);
    this.name = "CivicServiceError";
  }
}

function projectUrl(): string {
  const value = process.env.SUPABASE_URL;
  if (!value) {
    throw new CivicServiceError("Supabase is not configured.", 503);
  }
  return value.replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}

function publishableKey(): string {
  const value =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!value) {
    throw new CivicServiceError("Supabase is not configured.", 503);
  }
  return value;
}

function serverSecretKey(): string {
  const value = process.env.SUPABASE_SECRET_KEY;
  if (!value) {
    throw new CivicServiceError("Supabase server access is not configured.", 503);
  }
  return value;
}

export async function authenticateSupabaseToken(
  accessToken: string,
): Promise<SupabaseIdentity> {
  const response = await fetch(`${projectUrl()}/auth/v1/user`, {
    headers: {
      apikey: publishableKey(),
      authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new CivicServiceError("Your session is invalid or has expired.", 401);
  }

  const user: unknown = await response.json();
  if (
    typeof user !== "object" ||
    user === null ||
    !("id" in user) ||
    typeof user.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      user.id,
    )
  ) {
    throw new CivicServiceError("Your session is invalid or has expired.", 401);
  }

  return {
    id: user.id,
    email: "email" in user && typeof user.email === "string" ? user.email : null,
  };
}

export async function getProfile(
  accessToken: string,
  user: SupabaseIdentity,
): Promise<ProfileIdentity> {
  const query = new URLSearchParams({
    select: "id,email,full_name,role,department",
    id: `eq.${user.id}`,
    limit: "1",
  });
  let rows: unknown[] = [];
  try {
    rows = await supabaseRequest<unknown[]>(
      `rest/v1/profiles?${query.toString()}`,
      accessToken,
    );
  } catch (err) {
    throw err;
  }

  // If user row is missing from profiles (e.g. registered before schema trigger), auto-provision profile using server key
  if (!Array.isArray(rows) || rows.length === 0) {
    try {
      const secret = serverSecretKey();
      const insertResponse = await fetch(`${projectUrl()}/rest/v1/profiles`, {
        method: "POST",
        headers: {
          apikey: secret,
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
          prefer: "return=representation",
        },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          role: "admin",
          full_name: null,
          department: null,
        }),
      });
      if (insertResponse.ok) {
        const created = await insertResponse.json();
        if (Array.isArray(created) && created.length > 0) {
          rows = created;
        }
      }
    } catch {
      // Continue to validation below
    }
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new CivicServiceError(
      "Your municipal profile is not ready. Ask an administrator to check the Supabase setup.",
      403,
    );
  }

  const row: unknown = rows[0];
  if (typeof row !== "object" || row === null || !("role" in row)) {
    throw new CivicServiceError("Your municipal profile could not be loaded.", 403);
  }

  const role = row.role;
  if (
    role !== "admin" &&
    role !== "municipal_officer" &&
    role !== "department_officer" &&
    role !== "viewer"
  ) {
    throw new CivicServiceError("Your municipal role is not valid.", 403);
  }

  return {
    id: user.id,
    email: "email" in row && typeof row.email === "string" ? row.email : user.email,
    full_name:
      "full_name" in row && typeof row.full_name === "string" ? row.full_name : null,
    department:
      "department" in row && typeof row.department === "string"
        ? row.department
        : null,
    role,
  };
}

export async function supabaseRequestWithMeta<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<{ data: T; contentRange: string | null }> {
  const headers = new Headers(init.headers);
  headers.set("apikey", publishableKey());
  headers.set("authorization", `Bearer ${accessToken}`);
  if (init.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${projectUrl()}/${path.replace(/^\/+/, "")}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(12_000),
  });
  const responseText = await response.text();
  const contentRange = response.headers.get("content-range");

  if (!response.ok) {
    let errorDetail: { code?: string; message?: string; details?: string; hint?: string } | null = null;
    try {
      errorDetail = JSON.parse(responseText);
    } catch {
      // Not JSON
    }

    if (errorDetail?.code === "PGRST205" || errorDetail?.code === "PGRST202") {
      throw new CivicServiceError(
        `Database setup incomplete: ${errorDetail.message || "database object not found"}. Ensure supabase/schema.sql has been executed in the Supabase SQL Editor.`,
        503,
        errorDetail.code,
        errorDetail.details || errorDetail.message,
      );
    }

    if (response.status === 401) {
      throw new CivicServiceError("Your session is invalid or has expired.", 401, errorDetail?.code);
    }
    if (response.status === 403) {
      throw new CivicServiceError(
        "You do not have permission to perform this civic action.",
        403,
        errorDetail?.code,
        errorDetail?.message,
      );
    }
    if (response.status === 404) {
      throw new CivicServiceError("The requested record was not found.", 404, errorDetail?.code);
    }
    if (response.status === 409) {
      throw new CivicServiceError("A record with that identifier already exists.", 409, errorDetail?.code);
    }
    const safeMsg = errorDetail?.message
      ? `Database error: ${errorDetail.message}`
      : "Unable to load data. Please try again.";
    throw new CivicServiceError(safeMsg, 502, errorDetail?.code, errorDetail?.details || responseText);
  }

  if (response.status === 204 || responseText.trim() === "") {
    return { data: null as T, contentRange };
  }

  let data: unknown;
  try {
    data = JSON.parse(responseText) as unknown;
  } catch {
    throw new CivicServiceError("Supabase returned an unreadable response.", 502);
  }

  return { data: data as T, contentRange };
}

export async function supabaseRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const result = await supabaseRequestWithMeta<T>(path, accessToken, init);
  return result.data;
}

export async function supabaseHead(
  path: string,
  accessToken: string,
): Promise<string | null> {
  const response = await fetch(`${projectUrl()}/${path.replace(/^\/+/, "")}`, {
    method: "HEAD",
    headers: {
      apikey: publishableKey(),
      authorization: `Bearer ${accessToken}`,
      prefer: "count=exact",
      range: "0-0",
      "range-unit": "items",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new CivicServiceError("You do not have permission to view this data.", 403);
    }
    throw new CivicServiceError("Unable to load data. Please try again.", 502);
  }

  return response.headers.get("content-range");
}

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const secret = serverSecretKey();
    const response = await fetch(
      `${projectUrl()}/rest/v1/areas?select=id&limit=1`,
      {
        method: "HEAD",
        headers: {
          apikey: secret,
          authorization: `Bearer ${secret}`,
        },
        signal: AbortSignal.timeout(4_000),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}
