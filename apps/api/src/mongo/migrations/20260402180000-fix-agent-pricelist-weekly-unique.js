/**
 * Removes the legacy unique index on (agentId, supplierId) which allowed only one
 * pricelist per agent+supplier ever. Agent pricelists are weekly: multiple weeks
 * are allowed; uniqueness is (agentId, supplierId, weekStart) for active statuses.
 *
 * Ensures the partial unique index matches agent-pricelist.schema.ts.
 */
module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("agent_pricelists");
    const collections = await db
      .listCollections({ name: "agent_pricelists" })
      .toArray();
    if (collections.length === 0) {
      console.log(
        "ℹ️  agent_pricelists collection missing, skipping weekly-unique migration",
      );
      return;
    }

    const indexes = await collection.indexes();
    const legacyName = "agentId_1_supplierId_1";
    const legacy = indexes.find((i) => i.name === legacyName);
    if (legacy && legacy.unique) {
      await collection.dropIndex(legacyName);
      console.log(
        `✅ Dropped legacy unique index ${legacyName} (allows multiple weeks per agent+supplier)`,
      );
    } else if (legacy) {
      console.log(
        `ℹ️  Index ${legacyName} exists but is not unique, skipping drop`,
      );
    }

    const activeStatuses = ["draft", "submitted", "approved"];
    const refreshed = await collection.indexes();
    const hasWeeklyPartialUnique = refreshed.some((idx) => {
      if (!idx.unique || !idx.key) return false;
      const k = idx.key;
      if (k.agentId !== 1 || k.supplierId !== 1 || k.weekStart !== 1) {
        return false;
      }
      const p = idx.partialFilterExpression;
      if (!p || !p.status || !p.status.$in) return false;
      const ins = p.status.$in;
      if (!Array.isArray(ins) || ins.length !== activeStatuses.length) {
        return false;
      }
      return activeStatuses.every((s) => ins.includes(s));
    });

    if (hasWeeklyPartialUnique) {
      console.log(
        "ℹ️  Partial unique index on agentId+supplierId+weekStart (active statuses) already exists",
      );
      return;
    }

    await collection.createIndex(
      { agentId: 1, supplierId: 1, weekStart: 1 },
      {
        unique: true,
        partialFilterExpression: {
          status: { $in: activeStatuses },
        },
      },
    );
    console.log(
      "✅ Created partial unique index on agentId + supplierId + weekStart (draft|submitted|approved)",
    );
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("agent_pricelists");
    const collections = await db
      .listCollections({ name: "agent_pricelists" })
      .toArray();
    if (collections.length === 0) return;

    const indexes = await collection.indexes();
    for (const idx of indexes) {
      if (!idx.unique || !idx.key) continue;
      const k = idx.key;
      if (k.agentId !== 1 || k.supplierId !== 1 || k.weekStart !== 1) continue;
      if (!idx.partialFilterExpression) continue;
      try {
        await collection.dropIndex(idx.name);
        console.log(`❌ Dropped partial weekly unique index: ${idx.name}`);
      } catch (e) {
        if (e.code !== 27) throw e;
      }
    }
    // Do not recreate agentId+supplierId unique index on down — unsafe if multiple weeks exist
  },
};
