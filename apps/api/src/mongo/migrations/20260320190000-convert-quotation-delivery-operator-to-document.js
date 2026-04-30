module.exports = {
  /**
   * Convert quotation_deliveries operator fields:
   * - from flat fields (operatorId/operatorEmail)
   * - to embedded document operator: { id, email, name }
   */
  async up(db, client) {
    const collection = db.collection("quotation_deliveries");
    const users = db.collection("users");

    const { ObjectId } = require("mongodb");

    const deliveries = await collection
      .find(
        {
          $or: [
            { operator: { $exists: false } },
            { "operator.id": { $exists: false } },
          ],
          sentBy: { $exists: true, $ne: null },
        },
        {
          projection: {
            _id: 1,
            sentBy: 1,
            operatorId: 1,
            operatorEmail: 1,
          },
        },
      )
      .toArray();

    if (deliveries.length > 0) {
      const userIds = Array.from(
        new Set(
          deliveries.map((d) => {
            const id = d.operatorId || d.sentBy;
            return id && id.toString ? id.toString() : null;
          }).filter(Boolean),
        ),
      ).map((id) => new ObjectId(id));

      const userDocs = await users
        .find(
          { _id: { $in: userIds } },
          { projection: { email: 1, firstName: 1, lastName: 1 } },
        )
        .toArray();

      const userById = new Map(userDocs.map((u) => [u._id.toString(), u]));

      const ops = deliveries.map((d) => {
        const rawOperatorId = d.operatorId || d.sentBy;
        const operatorId =
          rawOperatorId && rawOperatorId.toString
            ? new ObjectId(rawOperatorId.toString())
            : null;
        const user = operatorId ? userById.get(operatorId.toString()) : undefined;
        const fullName = user
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : "";

        const operator = operatorId
          ? {
              id: operatorId,
              ...(d.operatorEmail || user?.email
                ? { email: d.operatorEmail || user?.email }
                : {}),
              ...(fullName ? { name: fullName } : {}),
            }
          : undefined;

        return {
          updateOne: {
            filter: { _id: d._id },
            update: {
              ...(operator ? { $set: { operator } } : {}),
              $unset: { operatorId: "", operatorEmail: "" },
            },
          },
        };
      });

      await collection.bulkWrite(ops);
      console.log(
        `✅ Converted operator fields to embedded document for ${deliveries.length} quotation_deliveries record(s)`,
      );
    } else {
      console.log("ℹ️ No quotation_deliveries records required operator conversion");
    }

    // Ensure index on embedded operator.id
    const indexes = await collection.indexes();
    const hasEmbeddedIndex = indexes.some((i) => i.name === "operator.id_1");
    if (!hasEmbeddedIndex) {
      await collection.createIndex({ "operator.id": 1 });
      console.log("✅ Created index quotation_deliveries.operator.id_1");
    }

    // Drop old flat index if present
    const hasOldIndex = indexes.some((i) => i.name === "operatorId_1");
    if (hasOldIndex) {
      await collection.dropIndex("operatorId_1");
      console.log("🗑️ Dropped old index quotation_deliveries.operatorId_1");
    }
  },

  async down(db, client) {
    const collection = db.collection("quotation_deliveries");

    // Restore flat fields from operator document
    const docs = await collection
      .find(
        { "operator.id": { $exists: true } },
        { projection: { _id: 1, operator: 1 } },
      )
      .toArray();

    if (docs.length > 0) {
      const ops = docs.map((d) => ({
        updateOne: {
          filter: { _id: d._id },
          update: {
            $set: {
              operatorId: d.operator.id,
              ...(d.operator.email ? { operatorEmail: d.operator.email } : {}),
            },
            $unset: { operator: "" },
          },
        },
      }));
      await collection.bulkWrite(ops);
      console.log(
        `↩️ Restored flat operator fields for ${docs.length} quotation_deliveries record(s)`,
      );
    }

    const indexes = await collection.indexes();
    if (!indexes.some((i) => i.name === "operatorId_1")) {
      await collection.createIndex({ operatorId: 1 });
      console.log("✅ Recreated index quotation_deliveries.operatorId_1");
    }
    if (indexes.some((i) => i.name === "operator.id_1")) {
      await collection.dropIndex("operator.id_1");
      console.log("🗑️ Dropped index quotation_deliveries.operator.id_1");
    }
  },
};

