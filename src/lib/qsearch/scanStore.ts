// qSearch scan history in Supabase. Server only: it uses the service role key.
//
// Every function takes the owner's id from the caller, which must take it from
// the verified session, never from user input. Table: supabase/qsearch_scans.sql.

import type { ScanData } from "@/app/qsearch/actions";
import type { ComparableFinding } from "@/lib/qsearch/compare";
import { cleanSystem, type SystemDetails } from "@/lib/qsearch/inventory";
import { supabase } from "@/lib/supabase/client";

const TABLE = "qsearch_scans";

/** Older scans beyond this many per owner are deleted after each save. */
export const MAX_SCANS_PER_OWNER = 50;

const SUMMARY_COLUMNS = "id, project, file_name, created_at, files_scanned, quantum_vulnerable, high_risk, pqc_ready";

export interface ScanSummary {
  id: string;
  project: string;
  fileName: string;
  createdAt: string;
  filesScanned: number;
  quantumVulnerable: number;
  highRisk: number;
  pqcReady: number;
}

interface SummaryRow {
  id: string;
  project: string;
  file_name: string;
  created_at: string;
  files_scanned: number;
  quantum_vulnerable: number;
  high_risk: number;
  pqc_ready: number;
}

/** Thrown when the database fails. Details are logged, never shown. */
export class StoreError extends Error {}

function fail(action: string, error: unknown): never {
  console.error(`[qsearch store] ${action} failed:`, error);
  throw new StoreError(action);
}

const toSummary = (row: SummaryRow): ScanSummary => ({
  id: row.id,
  project: row.project,
  fileName: row.file_name,
  createdAt: row.created_at,
  filesScanned: row.files_scanned,
  quantumVulnerable: row.quantum_vulnerable,
  highRisk: row.high_risk,
  pqcReady: row.pqc_ready,
});

export async function saveScan(
  ownerId: string,
  project: string,
  fileName: string,
  scan: ScanData,
  system: SystemDetails | null,
): Promise<{ id: string; createdAt: string }> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      owner_id: ownerId,
      project,
      file_name: fileName,
      files_scanned: scan.files_scanned,
      quantum_vulnerable: scan.quantum_vulnerable,
      high_risk: scan.high_risk,
      pqc_ready: scan.pqc_ready,
      findings: scan.findings,
      reports: scan.reports,
      system,
    })
    .select("id, created_at")
    .single();
  if (error || !data) fail("save", error);

  // Keep only the newest scans. A failure here leaves extra rows, not lost ones.
  const { data: old, error: listError } = await supabase
    .from(TABLE)
    .select("id")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .range(MAX_SCANS_PER_OWNER, MAX_SCANS_PER_OWNER + 999);
  if (listError) console.error("[qsearch store] prune list failed:", listError);
  else if (old.length > 0) {
    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .eq("owner_id", ownerId)
      .in(
        "id",
        old.map((row) => row.id),
      );
    if (deleteError) console.error("[qsearch store] prune failed:", deleteError);
  }

  return { id: data.id, createdAt: data.created_at };
}

/** The latest scan of this project, made before `before` when given. */
export async function previousScan(
  ownerId: string,
  project: string,
  before?: string,
): Promise<{ createdAt: string; findings: ComparableFinding[]; system: SystemDetails | null } | null> {
  let query = supabase.from(TABLE).select("created_at, findings, system").eq("owner_id", ownerId).eq("project", project);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) fail("previous", error);
  return data
    ? { createdAt: data.created_at, findings: data.findings, system: data.system ? cleanSystem(data.system) : null }
    : null;
}

export async function listScans(ownerId: string): Promise<ScanSummary[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(SUMMARY_COLUMNS)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(MAX_SCANS_PER_OWNER);
  if (error) fail("list", error);
  return (data as SummaryRow[]).map(toSummary);
}

export async function getScan(
  ownerId: string,
  id: string,
): Promise<(ScanSummary & { scan: ScanData; system: SystemDetails | null }) | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`${SUMMARY_COLUMNS}, findings, reports, system`)
    .eq("owner_id", ownerId)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("get", error);
  if (!data) return null;
  const row = data as SummaryRow & Pick<ScanData, "findings" | "reports"> & { system: unknown };
  return {
    ...toSummary(row),
    system: row.system ? cleanSystem(row.system) : null,
    scan: {
      files_scanned: row.files_scanned,
      quantum_vulnerable: row.quantum_vulnerable,
      high_risk: row.high_risk,
      pqc_ready: row.pqc_ready,
      findings: row.findings,
      reports: row.reports,
    },
  };
}

/** Returns false when no scan with this id belongs to the owner. */
export async function deleteScan(ownerId: string, id: string): Promise<boolean> {
  const { data, error } = await supabase.from(TABLE).delete().eq("owner_id", ownerId).eq("id", id).select("id");
  if (error) fail("delete", error);
  return data.length > 0;
}

/** Returns false when no scan with this id belongs to the owner. */
export async function updateSystem(ownerId: string, id: string, system: SystemDetails): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ system })
    .eq("owner_id", ownerId)
    .eq("id", id)
    .select("id");
  if (error) fail("update system", error);
  return data.length > 0;
}