import cloneDeep from "lodash/cloneDeep";
import omit from "lodash/omit";

/**
 * Fields that must not participate in quotation snapshot comparison for deduplication.
 * (volatile / metadata only). Includes "status" so that re-sending the same quotation
 * after it was marked "sent" does not create a duplicate delivery when content is unchanged.
 */
const VOLATILE_SNAPSHOT_KEYS = [
  "createdAt",
  "updatedAt",
  "__v",
  "status",
] as const;

/**
 * Normalizes a quotation snapshot for comparison so that only meaningful business
 * content is considered. Removes volatile and metadata fields that would cause
 * false positives when deciding whether to create a new delivery.
 *
 * @param snapshot - Raw quotation snapshot (plain object or document)
 * @returns Normalized plain object suitable for _.isEqual comparison
 */
export function normalizeQuotationSnapshotForComparison(
  snapshot: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (snapshot == null || typeof snapshot !== "object") {
    return {};
  }
  const cloned = cloneDeep(snapshot) as Record<string, unknown>;
  return omit(cloned, VOLATILE_SNAPSHOT_KEYS) as Record<string, unknown>;
}
