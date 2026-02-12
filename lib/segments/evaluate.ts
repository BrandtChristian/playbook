import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolves contacts for a segment (static or dynamic).
 * Calls the PL/pgSQL `resolve_segment_contacts` function.
 */
export async function getContactsForSegment(
  supabase: SupabaseClient,
  segmentId: string
) {
  const { data, error } = await supabase.rpc("resolve_segment_contacts", {
    p_segment_id: segmentId,
  });

  if (error) {
    throw new Error(`Failed to resolve segment: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Previews a dynamic segment filter without saving.
 * Returns matching contacts for the given filter rules.
 */
export async function previewSegmentFilter(
  supabase: SupabaseClient,
  orgId: string,
  filterRules: unknown
) {
  const { data, error } = await supabase.rpc("preview_segment_filter", {
    p_org_id: orgId,
    p_filter_rules: filterRules,
  });

  if (error) {
    throw new Error(`Failed to preview segment: ${error.message}`);
  }

  return data ?? [];
}
