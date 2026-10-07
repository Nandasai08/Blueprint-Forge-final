import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type RequestHandler, type Response } from "express";
import {
  CreateCivicRecordBody,
  CreateCivicRecordResponse,
  DeleteCivicRecordParams,
  GetAreaSummaryParams,
  GetAreaSummaryResponse,
  GetCivicRecordParams,
  GetCivicRecordResponse,
  GetCivicRecordsParams,
  GetCivicRecordsQueryParams,
  GetCivicRecordsResponse,
  GetCivicReportQueryParams,
  GetCivicReportResponse,
  GetCurrentProfileResponse,
  GetDashboardStatsResponse,
  GetNotificationsResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  SearchCivicDataQueryParams,
  SearchCivicDataResponse,
  UpdateCivicRecordBody,
  UpdateCivicRecordParams,
  UpdateCivicRecordResponse,
} from "@workspace/api-zod";
import {
  authenticateSupabaseToken,
  CivicServiceError,
  getProfile,
  supabaseHead,
  supabaseRequest,
  supabaseRequestWithMeta,
  type ProfileIdentity,
} from "../lib/supabase";

type CivicResource =
  | "complaints"
  | "infrastructure"
  | "sanitation"
  | "maintenance"
  | "areas";

type CivicUser = ProfileIdentity & { accessToken: string };
type Row = Record<string, unknown>;

const resourceConfig: Record<
  CivicResource,
  { search: string[]; sort: string[] }
> = {
  complaints: {
    search: ["title", "description", "complaint_number", "category", "location"],
    sort: ["reported_at", "created_at", "updated_at", "title", "priority", "status"],
  },
  infrastructure: {
    search: ["name", "asset_number", "asset_type", "location", "description"],
    sort: ["created_at", "updated_at", "name", "condition", "status", "last_inspection"],
  },
  sanitation: {
    search: ["location", "assigned_team", "notes", "collection_status"],
    sort: ["created_at", "updated_at", "location", "condition", "next_collection"],
  },
  maintenance: {
    search: ["title", "maintenance_number", "category", "location", "assigned_team"],
    sort: ["created_at", "updated_at", "title", "priority", "status", "expected_completion"],
  },
  areas: {
    search: ["name", "code", "description"],
    sort: ["name", "code", "population", "created_at", "updated_at"],
  },
};

function getCivicUser(response: Response): CivicUser {
  return (response.locals as { civicUser: CivicUser }).civicUser;
}

function sendServiceError(error: unknown, request: Request, response: Response): void {
  request.log.error({ err: error }, "Civic API request failed");
  if (error instanceof CivicServiceError) {
    response.status(error.statusCode).json({
      error: error.message,
      code: error.code,
    });
    return;
  }
  response.status(500).json({ error: "Unable to load data. Please try again." });
}

function withErrors(
  handler: (request: Request, response: Response) => Promise<void>,
): RequestHandler {
  return async (request, response, _next) => {
    try {
      await handler(request, response);
    } catch (error) {
      sendServiceError(error, request, response);
    }
  };
}

const authenticate: RequestHandler = async (request, response, next) => {
  const authorization = request.header("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    response.status(401).json({ error: "Sign in to access civic records." });
    return;
  }

  try {
    const identity = await authenticateSupabaseToken(match[1]);
    const profile = await getProfile(match[1], identity);
    (response.locals as { civicUser: CivicUser }).civicUser = {
      ...profile,
      accessToken: match[1],
    };
    next();
  } catch (error) {
    if (error instanceof CivicServiceError) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }
    request.log.error({ err: error }, "Supabase authentication failed");
    response.status(503).json({ error: "Unable to verify your session. Please try again." });
  }
};

function isResource(value: string): value is CivicResource {
  return Object.hasOwn(resourceConfig, value);
}

function parseResource(
  value: unknown,
): CivicResource {
  if (typeof value !== "string" || !isResource(value)) {
    throw new CivicServiceError("That civic resource is not supported.", 400);
  }
  return value;
}

function cleanSearch(value: string): string {
  return value.replace(/[,()%*"\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

function cleanFilter(value: string): string {
  return value.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 80);
}

function canonicalEnumValue(
  resource: CivicResource,
  field: string,
  value: string,
): string {
  const normalized = cleanFilter(value).replace(/[_-]+/g, " ").toLowerCase();
  const aliases: Partial<Record<CivicResource, Record<string, string>>> = {
    complaints: { open: "Pending", closed: "Resolved" },
    infrastructure: { open: "Operational" },
    sanitation: { open: "Scheduled", pending: "Scheduled", completed: "Collected" },
    maintenance: { open: "Planned", resolved: "Completed" },
  };
  const alias = aliases[resource]?.[normalized];
  if (alias) return alias;

  const valid: Partial<Record<CivicResource, Record<string, string[]>>> = {
    complaints: {
      priority: ["Low", "Medium", "High", "Critical"],
      status: ["Pending", "In Progress", "Resolved", "Rejected"],
      category: ["Roads", "Streetlights", "Water Supply", "Drainage", "Waste Management", "Public Safety", "Other"],
    },
    infrastructure: {
      status: ["Operational", "Needs Maintenance", "Under Repair", "Non Operational"],
      condition: ["Good", "Fair", "Poor", "Critical"],
      asset_type: ["Road", "Streetlight", "Water Pipeline", "Drainage", "Public Building", "Bridge", "Other"],
    },
    sanitation: {
      status: ["Scheduled", "Collected", "Delayed", "Missed"],
      collection_status: ["Scheduled", "Collected", "Delayed", "Missed"],
      condition: ["Clean", "Moderate", "Needs Attention", "Critical"],
      waste_level: ["Low", "Medium", "High", "Critical"],
    },
    maintenance: {
      priority: ["Low", "Medium", "High", "Critical"],
      status: ["Planned", "In Progress", "Completed", "Delayed", "Cancelled"],
    },
  };
  const candidate = valid[resource]?.[field]?.find(
    (item) => item.toLowerCase() === normalized,
  );
  if (candidate) return candidate;
  return normalized.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function listUrl(
  resource: CivicResource,
  options: {
    select?: string;
    search?: string;
    status?: string;
    priority?: string;
    category?: string;
    areaId?: string;
    condition?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    sort?: string;
    direction?: "asc" | "desc";
  } = {},
): string {
  const query = new URLSearchParams();
  query.set("select", options.select ?? (resource === "areas" ? "*" : "*,areas(name)"));
  const clean = options.search ? cleanSearch(options.search) : "";
  if (clean) {
    const fields = resourceConfig[resource].search;
    query.set(
      "or",
      `(${fields.map((field) => `${field}.ilike.*${clean}*`).join(",")})`,
    );
  }
  for (const [field, value] of [
    ["status", options.status],
    ["priority", options.priority],
    ["category", options.category],
    ["condition", options.condition],
  ] as const) {
    if (!value) continue;
    if (resource === "areas" && field === "status") continue;
    if (["infrastructure", "sanitation", "areas"].includes(resource) && field === "category") continue;
    if (["infrastructure", "sanitation", "areas"].includes(resource) && field === "priority") continue;
    if (["complaints", "maintenance", "areas"].includes(resource) && field === "condition") continue;
    const queryField = resource === "sanitation" && field === "status" ? "collection_status" : field;
    const enumField = resource === "sanitation" && field === "status" ? "collection_status" : field;
    query.set(queryField, `eq.${canonicalEnumValue(resource, enumField, value)}`);
  }
  if (options.areaId && /^[0-9a-f-]{36}$/i.test(options.areaId)) {
    query.set("area_id", `eq.${options.areaId}`);
  }
  if (options.startDate) {
    const dateField = resource === "complaints" ? "reported_at" : "created_at";
    query.set(dateField, `gte.${options.startDate}`);
  }
  if (options.endDate) {
    const dateField = resource === "complaints" ? "reported_at" : "created_at";
    query.set(dateField, `lte.${options.endDate}T23:59:59.999Z`);
  }
  if (options.sort) {
    const sort = resourceConfig[resource].sort.includes(options.sort)
      ? options.sort
      : "updated_at";
    query.set("order", `${sort}.${options.direction ?? "desc"}.nullslast`);
  }
  if (options.limit !== undefined) query.set("limit", String(options.limit));
  if (options.offset !== undefined) query.set("offset", String(options.offset));
  return `rest/v1/${resource}?${query.toString()}`;
}

function normalizeRow(row: Row): Row {
  const areaValue = row.areas;
  let areaName: string | null = null;
  if (Array.isArray(areaValue)) {
    const first = areaValue[0];
    if (typeof first === "object" && first !== null && "name" in first) {
      areaName = typeof first.name === "string" ? first.name : null;
    }
  } else if (typeof areaValue === "object" && areaValue !== null && "name" in areaValue) {
    areaName = typeof areaValue.name === "string" ? areaValue.name : null;
  }
  const normalized: Row = { ...row };
  delete normalized.areas;
  if (areaName !== null) normalized.area_name = areaName;
  return normalized;
}

function normalizeRows(value: unknown): Row[] {
  if (!Array.isArray(value)) {
    throw new CivicServiceError("Supabase returned an unexpected data shape.", 502);
  }
  return value
    .filter((row): row is Row => typeof row === "object" && row !== null && !Array.isArray(row))
    .map(normalizeRow);
}

function totalFromRange(range: string | null, fallback: number): number {
  if (!range) return fallback;
  const total = range.split("/")[1];
  if (!total || total === "*") return fallback;
  const parsed = Number(total);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function requireWritable(
  user: CivicUser,
  action: "create" | "update" | "delete",
): void {
  if (user.role === "admin") return;
  if (action === "create" && user.role === "municipal_officer") return;
  if (action === "update" && user.role === "municipal_officer") return;
  if (action === "update" && user.role === "department_officer") return;
  throw new CivicServiceError("Your role does not allow this action.", 403);
}

function requiredFields(resource: CivicResource): string[] {
  const fields: Record<CivicResource, string[]> = {
    complaints: ["title", "category", "location", "area_id"],
    infrastructure: ["asset_type", "name", "location", "area_id"],
    sanitation: ["location", "area_id"],
    maintenance: ["title", "category", "location", "area_id"],
    areas: ["name", "code"],
  };
  return fields[resource];
}

function makeRecordNumber(prefix: string): string {
  return `${prefix}-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function payloadForResource(
  resource: CivicResource,
  input: Record<string, unknown>,
  user: CivicUser,
  creating: boolean,
): Row {
  const allowedFields: Record<CivicResource, string[]> = {
    complaints: [
      "title", "description", "category", "location", "area_id", "priority", "status",
      "assigned_department", "assigned_officer", "resolved_at", "notes",
    ],
    infrastructure: [
      "asset_type", "name", "location", "area_id", "condition", "status",
      "assigned_department", "last_inspection", "next_maintenance", "description", "notes",
    ],
    sanitation: [
      "area_id", "location", "waste_level", "collection_status", "last_collection",
      "next_collection", "assigned_team", "assigned_department", "condition", "notes",
    ],
    maintenance: [
      "title", "description", "category", "location", "area_id", "assigned_department",
      "assigned_team", "priority", "status", "start_date", "expected_completion",
      "actual_completion", "progress", "notes",
    ],
    areas: ["name", "code", "description", "population"],
  };

  const clean: Row = {};
  for (const field of allowedFields[resource]) {
    if (!Object.hasOwn(input, field)) continue;
    const value = input[field];
    if (creating && value === "") continue;
    if (
      typeof value === "string" &&
      ["priority", "status", "condition", "waste_level", "collection_status", "asset_type", "category"].includes(field) &&
      value.trim() !== ""
    ) {
      clean[field] = canonicalEnumValue(resource, field, value);
    } else {
      clean[field] = value;
    }
  }

  if (resource === "infrastructure") {
    if (!clean.name && typeof input.title === "string" && input.title.trim()) {
      clean.name = input.title.trim();
    }
    if (!clean.asset_type && typeof input.category === "string" && input.category.trim()) {
      clean.asset_type = canonicalEnumValue(resource, "asset_type", input.category);
    }
  }

  if (creating && resource === "complaints") {
    clean.complaint_number = makeRecordNumber("SC");
    clean.reported_by = user.id;
  }
  if (creating && resource === "infrastructure") {
    clean.asset_number = makeRecordNumber("AST");
  }
  if (creating && resource === "maintenance") {
    clean.maintenance_number = makeRecordNumber("MNT");
  }
  if (
    !creating &&
    resource === "complaints" &&
    clean.status === "Resolved" &&
    !Object.hasOwn(clean, "resolved_at")
  ) {
    clean.resolved_at = new Date().toISOString();
  }
  return clean;
}

async function getOne(
  resource: CivicResource,
  id: string,
  user: CivicUser,
): Promise<Row> {
  const query = new URLSearchParams({
    select: resource === "areas" ? "*" : "*,areas(name)",
    id: `eq.${id}`,
    limit: "1",
  });
  const rows = normalizeRows(
    await supabaseRequest<unknown[]>(
      `rest/v1/${resource}?${query.toString()}`,
      user.accessToken,
    ),
  );
  if (!rows[0]) throw new CivicServiceError("The requested record was not found.", 404);
  return rows[0];
}

async function fetchSimpleRows(
  resource: CivicResource,
  user: CivicUser,
  options: Parameters<typeof listUrl>[1] = {},
): Promise<Row[]> {
  const data = await supabaseRequest<unknown[]>(
    listUrl(resource, { limit: 1000, ...options }),
    user.accessToken,
  );
  return normalizeRows(data);
}

function groupCounts(rows: Row[], key: string): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[key];
    if (typeof value !== "string" || value.length === 0) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function parseDate(value: unknown): number {
  if (typeof value !== "string") return 0;
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

const router: IRouter = Router();
router.use(authenticate);

router.get(
  "/dashboard/stats",
  withErrors(async (request, response) => {
    const user = getCivicUser(response);
    const result = await supabaseRequest<unknown>(
      "rest/v1/rpc/get_dashboard_stats",
      user.accessToken,
      { method: "POST", body: "{}" },
    );

    if (!result || typeof result !== "object") {
      throw new CivicServiceError(
        "Invalid response received from database dashboard aggregation.",
        502,
      );
    }

    let validatedStats;
    try {
      validatedStats = GetDashboardStatsResponse.parse(result);
    } catch (parseError) {
      request.log.error(
        { err: parseError, rawResult: result },
        "Dashboard statistics structure validation failed",
      );
      throw new CivicServiceError(
        "Dashboard data format does not match the expected API schema.",
        502,
      );
    }

    response.json(validatedStats);
  }),
);

router.get(
  "/civic/:resource",
  withErrors(async (request, response) => {
    const params = GetCivicRecordsParams.safeParse(request.params);
    const filters = GetCivicRecordsQueryParams.safeParse(request.query);
    if (!params.success || !filters.success) {
      response.status(400).json({ error: "Invalid search or pagination options." });
      return;
    }
    const resource = parseResource(params.data.resource);
    const user = getCivicUser(response);
    const { page = 1, page_size = 20, sort, direction } = filters.data;
    const offset = (page - 1) * page_size;
    const queryOptions: Parameters<typeof listUrl>[1] = {
      search: filters.data.search,
      status: filters.data.status,
      priority: filters.data.priority,
      category: filters.data.category,
      areaId: filters.data.area_id,
      condition: filters.data.condition,
      limit: page_size,
      offset,
      sort,
      direction,
    };
    const path = listUrl(resource, queryOptions);
    const [list, countRange] = await Promise.all([
      supabaseRequestWithMeta<unknown[]>(path, user.accessToken, {
        headers: {
          prefer: "count=exact",
          range: `${offset}-${offset + page_size - 1}`,
          "range-unit": "items",
        },
      }),
      supabaseHead(listUrl(resource, { ...queryOptions, limit: undefined, offset: undefined }), user.accessToken),
    ]);
    const result = GetCivicRecordsResponse.parse({
      items: normalizeRows(list.data),
      total: totalFromRange(countRange, totalFromRange(list.contentRange, list.data.length)),
      page,
      page_size,
    });
    response.json(result);
  }),
);

router.post(
  "/civic/:resource",
  withErrors(async (request, response) => {
    const params = GetCivicRecordsParams.safeParse(request.params);
    const parsed = CreateCivicRecordBody.safeParse(request.body);
    if (!params.success || !parsed.success) {
      response.status(400).json({ error: "Check the required fields and try again." });
      return;
    }
    const resource = parseResource(params.data.resource);
    const user = getCivicUser(response);
    requireWritable(user, "create");
    const payload = payloadForResource(resource, parsed.data, user, true);
    const missing = requiredFields(resource).filter((field) => {
      const value = payload[field];
      return typeof value !== "string" || value.trim().length === 0;
    });
    if (missing.length > 0) {
      response.status(400).json({ error: `Required fields are missing: ${missing.join(", ")}.` });
      return;
    }
    const rows = normalizeRows(
      await supabaseRequest<unknown[]>(
        `rest/v1/${resource}?select=${encodeURIComponent(resource === "areas" ? "*" : "*,areas(name)")}`,
        user.accessToken,
        {
          method: "POST",
          headers: { prefer: "return=representation" },
          body: JSON.stringify(payload),
        },
      ),
    );
    if (!rows[0]) throw new CivicServiceError("The record could not be created.", 502);
    response.status(201).json(CreateCivicRecordResponse.parse(rows[0]));
  }),
);

router.get(
  "/civic/:resource/:id",
  withErrors(async (request, response) => {
    const params = GetCivicRecordParams.safeParse(request.params);
    if (!params.success) {
      response.status(400).json({ error: "The record identifier is invalid." });
      return;
    }
    const resource = parseResource(params.data.resource);
    const user = getCivicUser(response);
    response.json(GetCivicRecordResponse.parse(await getOne(resource, params.data.id, user)));
  }),
);

router.patch(
  "/civic/:resource/:id",
  withErrors(async (request, response) => {
    const params = UpdateCivicRecordParams.safeParse(request.params);
    const parsed = UpdateCivicRecordBody.safeParse(request.body);
    if (!params.success || !parsed.success) {
      response.status(400).json({ error: "Check the fields and try again." });
      return;
    }
    const resource = parseResource(params.data.resource);
    const user = getCivicUser(response);
    requireWritable(user, "update");
    const payload = payloadForResource(resource, parsed.data, user, false);
    if (Object.keys(payload).length === 0) {
      response.status(400).json({ error: "There are no editable changes to save." });
      return;
    }
    const query = new URLSearchParams({
      id: `eq.${params.data.id}`,
      select: resource === "areas" ? "*" : "*,areas(name)",
    });
    const rows = normalizeRows(
      await supabaseRequest<unknown[]>(
        `rest/v1/${resource}?${query.toString()}`,
        user.accessToken,
        {
          method: "PATCH",
          headers: { prefer: "return=representation" },
          body: JSON.stringify(payload),
        },
      ),
    );
    if (!rows[0]) throw new CivicServiceError("The record was not found or cannot be updated.", 404);
    response.json(UpdateCivicRecordResponse.parse(rows[0]));
  }),
);

router.delete(
  "/civic/:resource/:id",
  withErrors(async (request, response) => {
    const params = DeleteCivicRecordParams.safeParse(request.params);
    if (!params.success) {
      response.status(400).json({ error: "The record identifier is invalid." });
      return;
    }
    const resource = parseResource(params.data.resource);
    const user = getCivicUser(response);
    requireWritable(user, "delete");
    const query = new URLSearchParams({
      id: `eq.${params.data.id}`,
      select: "id",
    });
    const rows = await supabaseRequest<unknown[]>(
      `rest/v1/${resource}?${query.toString()}`,
      user.accessToken,
      {
        method: "DELETE",
        headers: { prefer: "return=representation" },
      },
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new CivicServiceError("The record was not found or cannot be deleted.", 404);
    }
    response.status(204).send();
  }),
);

router.get(
  "/search",
  withErrors(async (request, response) => {
    const parsed = SearchCivicDataQueryParams.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ error: "Enter a search term." });
      return;
    }
    const user = getCivicUser(response);
    const search = cleanSearch(parsed.data.q);
    if (!search) {
      response.status(400).json({ error: "Enter a search term." });
      return;
    }
    const resourceNames: CivicResource[] = [
      "complaints",
      "infrastructure",
      "sanitation",
      "maintenance",
      "areas",
    ];
    const entries = await Promise.all(
      resourceNames.map(async (resource) => [
        resource,
        await fetchSimpleRows(resource, user, { search, sort: "updated_at", limit: 6 }),
      ] as const),
    );
    const result = Object.fromEntries(entries);
    response.json(SearchCivicDataResponse.parse(result));
  }),
);

router.get(
  "/reports",
  withErrors(async (request, response) => {
    const parsed = GetCivicReportQueryParams.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({ error: "Select a report type and valid filters." });
      return;
    }
    const resource = parseResource(parsed.data.resource);
    const user = getCivicUser(response);
    const queryOptions: Parameters<typeof listUrl>[1] = {
      search: undefined,
      areaId: parsed.data.area_id,
      status: parsed.data.status,
      category: parsed.data.category,
      startDate: parsed.data.start_date?.toISOString().slice(0, 10),
      endDate: parsed.data.end_date?.toISOString().slice(0, 10),
      sort: resource === "complaints" ? "reported_at" : "created_at",
      direction: "desc",
      limit: 1000,
    };
    const path = listUrl(resource, queryOptions);
    const result = await supabaseRequestWithMeta<unknown[]>(path, user.accessToken, {
      headers: { prefer: "count=exact", range: "0-999", "range-unit": "items" },
    });
    response.json(
      GetCivicReportResponse.parse({
        items: normalizeRows(result.data),
        total: totalFromRange(result.contentRange, result.data.length),
        resource,
      }),
    );
  }),
);

router.get(
  "/areas/:id/summary",
  withErrors(async (request, response) => {
    const parsed = GetAreaSummaryParams.safeParse(request.params);
    if (!parsed.success) {
      response.status(400).json({ error: "The area identifier is invalid." });
      return;
    }
    const user = getCivicUser(response);
    const area = await getOne("areas", parsed.data.id, user);
    const areaFilter = `area_id=eq.${parsed.data.id}`;
    const count = async (resource: CivicResource, extra = "") => {
      const url = `rest/v1/${resource}?select=id&${areaFilter}${extra ? `&${extra}` : ""}`;
      return totalFromRange(await supabaseHead(url, user.accessToken), 0);
    };
    const [
      totalComplaints,
      pendingComplaints,
      infrastructureIssues,
      sanitationIssues,
      activeMaintenance,
      complaints,
      infrastructure,
      sanitation,
      maintenance,
    ] = await Promise.all([
      count("complaints"),
      count("complaints", "status=eq.Pending"),
      count("infrastructure", "condition=in.(Poor,Critical)"),
      count("sanitation", "condition=in.(Needs%20Attention,Critical)"),
      count("maintenance", "status=in.(Planned,In%20Progress,Delayed)"),
      fetchSimpleRows("complaints", user, { areaId: parsed.data.id, sort: "reported_at", limit: 4 }),
      fetchSimpleRows("infrastructure", user, { areaId: parsed.data.id, sort: "updated_at", limit: 2 }),
      fetchSimpleRows("sanitation", user, { areaId: parsed.data.id, sort: "updated_at", limit: 2 }),
      fetchSimpleRows("maintenance", user, { areaId: parsed.data.id, sort: "updated_at", limit: 2 }),
    ]);
    const recentActivity = [
      ...complaints,
      ...infrastructure,
      ...sanitation,
      ...maintenance,
    ]
      .sort((a, b) => parseDate(b.updated_at ?? b.created_at) - parseDate(a.updated_at ?? a.created_at))
      .slice(0, 8);
    response.json(
      GetAreaSummaryResponse.parse({
        area,
        total_complaints: totalComplaints,
        pending_complaints: pendingComplaints,
        infrastructure_issues: infrastructureIssues,
        sanitation_issues: sanitationIssues,
        active_maintenance: activeMaintenance,
        recent_activity: recentActivity,
      }),
    );
  }),
);

router.get(
  "/notifications",
  withErrors(async (_request, response) => {
    const user = getCivicUser(response);
    const query = new URLSearchParams({
      select: "id,user_id,title,message,type,is_read,created_at",
      user_id: `eq.${user.id}`,
      order: "created_at.desc",
      limit: "50",
    });
    const result = await supabaseRequest<unknown[]>(
      `rest/v1/notifications?${query.toString()}`,
      user.accessToken,
    );
    response.json(GetNotificationsResponse.parse(result));
  }),
);

router.patch(
  "/notifications/:id/read",
  withErrors(async (request, response) => {
    const parsed = MarkNotificationReadParams.safeParse(request.params);
    if (!parsed.success) {
      response.status(400).json({ error: "The notification identifier is invalid." });
      return;
    }
    const user = getCivicUser(response);
    const query = new URLSearchParams({
      id: `eq.${parsed.data.id}`,
      user_id: `eq.${user.id}`,
      select: "id,user_id,title,message,type,is_read,created_at",
    });
    const rows = await supabaseRequest<unknown[]>(
      `rest/v1/notifications?${query.toString()}`,
      user.accessToken,
      {
        method: "PATCH",
        headers: { prefer: "return=representation" },
        body: JSON.stringify({ is_read: true }),
      },
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new CivicServiceError("The notification was not found.", 404);
    }
    response.json(MarkNotificationReadResponse.parse(rows[0]));
  }),
);

router.get(
  "/profile",
  withErrors(async (_request, response) => {
    const user = getCivicUser(response);
    response.json(
      GetCurrentProfileResponse.parse({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
      }),
    );
  }),
);

export default router;
