module.exports = {
  /**
   * Backfill operator fields for quotation deliveries.
   * - operatorId defaults to sentBy
   * - operatorEmail is looked up from users by operatorId
   */
  async up(db, client) {
    const collection = db.collection("quotation_deliveries");
    const users = db.collection("users");

    // Create operatorId index for efficient filtering (if missing)
    const existingIndexes = await collection.indexes();
    const hasOperatorIndex = existingIndexes.some(
      (i) => i.name === "operatorId_1",
    );
    if (!hasOperatorIndex) {
      await collection.createIndex({ operatorId: 1 });
      console.log("✅ Created index quotation_deliveries.operatorId_1");
    } else {
      console.log("ℹ️ Index quotation_deliveries.operatorId_1 already exists");
    }

    const missingOperatorDocs = await collection
      .find(
        {
          $or: [
            { operatorId: { $exists: false } },
            { operatorId: null },
          ],
          sentBy: { $exists: true, $ne: null },
        },
        { projection: { sentBy: 1 } },
      )
      .toArray();

    if (missingOperatorDocs.length === 0) {
      console.log("ℹ️ No quotation_deliveries missing operator fields");
      return;
    }

    const distinctSentBy = Array.from(
      new Set(
        missingOperatorDocs.map((d) =>
          d.sentBy && d.sentBy.toString ? d.sentBy.toString() : String(d.sentBy),
        ),
      ),
    );

    const { ObjectId } = require("mongodb");
    const sentByIds = distinctSentBy.map((id) => new ObjectId(id));

    const userDocs = await users
      .find({ _id: { $in: sentByIds } }, { projection: { email: 1 } })
      .toArray();

    const emailById = new Map(
      userDocs.map((u) => [u._id.toString(), u.email]),
    );

    const bulkOps = [];
    for (const operatorId of sentByIds) {
      const operatorEmail = emailById.get(operatorId.toString());
      const update = {
        operatorId: operatorId,
        ...(operatorEmail ? { operatorEmail } : {}),
      };

      bulkOps.push({
        updateMany: {
          filter: {
            sentBy: operatorId,
            $or: [
              { operatorId: { $exists: false } },
              { operatorId: null },
            ],
          },
          update: { $set: update },
        },
      });
    }

    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps);
    }

    console.log(
      `✅ Backfilled operator fields for ${distinctSentBy.length} operator(s)`,
    );
  },

  async down(db, client) {
    const collection = db.collection("quotation_deliveries");
    // Keep it conservative: only unset if operator fields exist.
    await collection.updateMany(
      { $or: [{ operatorId: { $exists: true } }, { operatorEmail: { $exists: true } }] },
      { $unset: { operatorId: "", operatorEmail: "" } },
    );
    console.log("🗑️ Unset operator fields from quotation_deliveries");
  },
};

