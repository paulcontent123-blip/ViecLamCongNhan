import "server-only";
import { randomUUID } from "node:crypto";

type SupabaseErrorShape = { code?: unknown; message?: unknown };

function readSafeCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as SupabaseErrorShape).code;
  return typeof code === "string" && (/^[A-Z0-9]{5}$/.test(code) || /^PGRST[0-9]{3}$/.test(code)) ? code : null;
}

function categoryFor(code: string | null): string {
  if (!code) return "unknown";
  if (code === "PGRST200" || code === "PGRST201") return "relationship_schema";
  if (code === "PGRST202") return "rpc_schema";
  if (code === "PGRST204" || code === "42P01" || code === "42703") return "schema";
  if (code === "42501") return "permission";
  if (code.startsWith("08")) return "connection";
  if (code.startsWith("23")) return "constraint";
  return "query";
}

/** Logs only bounded diagnostic fields. Never pass Supabase message/details/hint to logs. */
export function logSafeSupabaseError(input: {
  route: string;
  operation: string;
  error: unknown;
}): string {
  const requestId = randomUUID();
  const code = readSafeCode(input.error);
  console.error(JSON.stringify({
    event: "supabase_request_failed",
    requestId,
    route: input.route,
    operation: input.operation,
    code: code ?? "UNKNOWN",
    category: categoryFor(code),
  }));
  return requestId;
}

export function isTrainingProviderUnverifiedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const shape = error as SupabaseErrorShape;
  return shape.code === "P0001" && shape.message === "PROVIDER_UNVERIFIED";
}

export function isInsuranceProviderUnverifiedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const shape = error as SupabaseErrorShape;
  return shape.code === "P0001" && shape.message === "INSURANCE_PROVIDER_UNVERIFIED";
}
