import { useAuthStore } from "../store/authStore";
import { apiUrl } from "./apiUrl";

export type SkillSideEffect = "none" | "write" | "external";
export type SkillLifecycleState = "completed" | "requires_confirmation" | "failed";
export type SkillOrigin = "assistant" | "agent" | "workflow" | "graphql" | "manual";

export interface SkillPermissionRequirement {
  resource: "table" | "workspace" | "skill" | "marketplace";
  action: "read" | "write" | "execute" | "manage";
  target_param?: string;
  optional?: boolean;
}

export interface SkillMetadata {
  name: string;
  version: string;
  title: string;
  description: string;
  tags: string[];
  side_effect: SkillSideEffect;
  confirmation_required: boolean;
  idempotent: boolean;
  supports_dry_run: boolean;
  visibility: "internal" | "workspace" | "marketplace";
  permissions: SkillPermissionRequirement[];
}

export interface SkillManifestEntry {
  metadata: SkillMetadata;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
}

export interface SkillCategory {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder: number;
}

export interface SkillRegistryEntry {
  id: string;
  workspaceId?: string | null;
  category?: SkillCategory | null;
  metadata: SkillMetadata;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  visibility: "internal" | "workspace" | "marketplace";
  sourceType: "builtin" | "workspace" | "marketplace" | "plugin";
  runtimeKind: "builtin" | "python_module" | "http_proxy" | "mcp" | "openai_tool";
  entrypoint?: string | null;
  modulePath?: string | null;
  handlerName?: string | null;
  icon?: string | null;
  latestVersion: string;
  status: "draft" | "active" | "disabled" | "deprecated";
  isEnabled: boolean;
  openaiToolSchema?: Record<string, unknown> | null;
  mcpToolSchema?: Record<string, unknown> | null;
  transportConfig: Record<string, unknown>;
  cacheTtlSeconds: number;
  embeddingStatus: string;
  embeddingText?: string | null;
  startedAt?: string | null;
  stoppedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface SkillRegistryResponse {
  skills: SkillRegistryEntry[];
  categories: SkillCategory[];
  registry?: Record<string, unknown>;
  error?: SkillError;
}

export interface SkillCallRequest<TInput extends Record<string, unknown> = Record<string, unknown>> {
  call_id?: string;
  skill_name: string;
  input: TInput;
  dry_run?: boolean;
  confirmed?: boolean;
  origin?: SkillOrigin;
  trace_id?: string;
}

export interface SkillError {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface RegisterSkillRequest {
  name: string;
  version?: string;
  title: string;
  description: string;
  category?: string;
  namespace?: string;
  workspaceId?: string;
  tags?: string[];
  visibility?: "internal" | "workspace" | "marketplace";
  source_type?: "builtin" | "workspace" | "marketplace" | "plugin";
  runtime_kind?: "builtin" | "python_module" | "http_proxy" | "mcp" | "openai_tool";
  side_effect?: SkillSideEffect;
  confirmation_required?: boolean;
  idempotent?: boolean;
  supports_dry_run?: boolean;
  entrypoint?: string;
  modulePath?: string;
  handlerName?: string;
  icon?: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permissions?: SkillPermissionRequirement[];
  transportConfig?: Record<string, unknown>;
  openaiToolSchema?: Record<string, unknown>;
  mcpToolSchema?: Record<string, unknown>;
  cacheTtlSeconds?: number;
  embeddingText?: string;
  changelog?: string;
}

export interface SkillStatusUpdateRequest {
  isEnabled: boolean;
  status: "draft" | "active" | "disabled" | "deprecated";
}

export interface SkillCallResponse<TOutput extends Record<string, unknown> = Record<string, unknown>> {
  call_id: string;
  skill_name: string;
  state: SkillLifecycleState;
  output?: TOutput;
  error?: SkillError;
  requires_confirmation: boolean;
  metadata: Record<string, unknown>;
}

export interface DescribeTableInput {
  tableId: string;
  includeSampleRows?: boolean;
  sampleLimit?: number;
}

export interface DescribeTableOutput {
  tableId: string;
  fieldCount: number;
  recordCount: number;
  fields: Array<Record<string, unknown>>;
  sampleRows: Array<Record<string, unknown>>;
}

export interface CreateRecordInput {
  tableId: string;
  values: Record<string, unknown>;
}

export interface CreateRecordOutput {
  tableId: string;
  recordId?: string | null;
  values: Record<string, unknown>;
  dryRun: boolean;
}

const SKILL_API_BASE = apiUrl("/api/skills");

function buildHeaders(): HeadersInit {
  const token = useAuthStore.getState().token;
  if (!token) {
    throw new Error("Unauthorized");
  }
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchSkillManifest(): Promise<SkillManifestEntry[]> {
  const registry = await fetchSkillRegistry();
  return registry.skills.map((item) => ({
    metadata: item.metadata,
    input_schema: item.inputSchema,
    output_schema: item.outputSchema,
  }));
}

export async function fetchSkillRegistry(params?: {
  workspaceId?: string;
  search?: string;
  category?: string;
  includeDisabled?: boolean;
}): Promise<SkillRegistryResponse> {
  const query = new URLSearchParams();
  if (params?.workspaceId) {
    query.set("workspaceId", params.workspaceId);
  }
  if (params?.search) {
    query.set("search", params.search);
  }
  if (params?.category) {
    query.set("category", params.category);
  }
  if (params?.includeDisabled) {
    query.set("includeDisabled", "true");
  }
  const queryString = query.toString();
  const response = await fetch(
    `${SKILL_API_BASE}/manifest${queryString ? `?${queryString}` : ""}`,
    {
    headers: buildHeaders(),
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to load manifest: ${response.status}`);
  }
  const data = (await response.json()) as SkillRegistryResponse;
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data;
}

export async function callSkill<TInput extends Record<string, unknown>, TOutput extends Record<string, unknown>>(
  request: SkillCallRequest<TInput>,
): Promise<SkillCallResponse<TOutput>> {
  const response = await fetch(`${SKILL_API_BASE}/call`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      dry_run: false,
      confirmed: false,
      origin: "assistant",
      ...request,
    }),
  });

  if (!response.ok) {
    throw new Error(`Skill call failed: ${response.status}`);
  }

  return (await response.json()) as SkillCallResponse<TOutput>;
}

export async function registerSkill(
  request: RegisterSkillRequest,
): Promise<SkillRegistryEntry> {
  const response = await fetch(`${SKILL_API_BASE}/registry/register`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({
      version: "1.0.0",
      category: "general",
      tags: [],
      visibility: "internal",
      source_type: "plugin",
      runtime_kind: "python_module",
      side_effect: "none",
      confirmation_required: false,
      idempotent: true,
      supports_dry_run: true,
      permissions: [],
      transportConfig: {},
      cacheTtlSeconds: 300,
      ...request,
    }),
  });
  if (!response.ok) {
    throw new Error(`Failed to register skill: ${response.status}`);
  }
  const data = (await response.json()) as { skill?: SkillRegistryEntry };
  if (!data.skill) {
    throw new Error("Invalid register skill response");
  }
  return data.skill;
}

export async function updateSkillStatus(
  skillId: string,
  request: SkillStatusUpdateRequest,
): Promise<SkillRegistryEntry> {
  const response = await fetch(`${SKILL_API_BASE}/registry/${skillId}/status`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Failed to update skill status: ${response.status}`);
  }
  const data = (await response.json()) as { skill?: SkillRegistryEntry };
  if (!data.skill) {
    throw new Error("Invalid update skill status response");
  }
  return data.skill;
}
