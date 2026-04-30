import { normalizeQuotationSnapshotForComparison } from "./quotation-snapshot-normalizer";

describe("normalizeQuotationSnapshotForComparison", () => {
  it("returns empty object for null", () => {
    expect(normalizeQuotationSnapshotForComparison(null)).toEqual({});
  });

  it("returns empty object for undefined", () => {
    expect(normalizeQuotationSnapshotForComparison(undefined)).toEqual({});
  });

  it("strips volatile metadata keys", () => {
    const snapshot = {
      clientId: "abc",
      total: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      __v: 0,
      status: "sent",
    };

    const result = normalizeQuotationSnapshotForComparison(snapshot);

    expect(result).not.toHaveProperty("createdAt");
    expect(result).not.toHaveProperty("updatedAt");
    expect(result).not.toHaveProperty("__v");
    expect(result).not.toHaveProperty("status");
  });

  it("preserves business-relevant fields", () => {
    const snapshot = {
      clientId: "c1",
      total: 500,
      legacyItems: [{ description: "Sea freight", price: 300 }],
      status: "draft",
    };

    const result = normalizeQuotationSnapshotForComparison(snapshot);

    expect(result.clientId).toBe("c1");
    expect(result.total).toBe(500);
    expect(result.legacyItems).toHaveLength(1);
  });

  it("two equal snapshots with different status produce identical normalized output", () => {
    const base = { clientId: "c1", total: 200, legacyItems: [] };
    const a = normalizeQuotationSnapshotForComparison({ ...base, status: "draft" });
    const b = normalizeQuotationSnapshotForComparison({ ...base, status: "sent" });

    expect(a).toEqual(b);
  });

  it("does not mutate the original snapshot", () => {
    const original = { clientId: "c1", status: "draft", total: 100 };
    normalizeQuotationSnapshotForComparison(original);

    expect(original).toHaveProperty("status", "draft");
  });
});
