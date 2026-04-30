module.exports = {
  /**
   * Enforce unique, normalized client emails.
   * 1) Normalize all existing client emails to lowercase+trim
   * 2) Resolve duplicates (keep one canonical client per email)
   * 3) Create unique partial index on email
   */
  async up(db, client) {
    const collection = db.collection("clients");
    const usersCollection = db.collection("users");

    // Normalize existing emails (trim + lowercase)
    const clientsWithEmail = await collection
      .find(
        { email: { $exists: true, $type: "string", $ne: "" } },
        { projection: { _id: 1, email: 1 } },
      )
      .toArray();

    const normalize = (value) => value.trim().toLowerCase();
    const bulkOps = [];
    for (const doc of clientsWithEmail) {
      const normalized = normalize(doc.email);
      if (normalized !== doc.email) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { email: normalized } },
          },
        });
      }
    }
    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps);
      console.log(`✅ Normalized ${bulkOps.length} client email(s)`);
    }

    // Find duplicates after normalization
    const duplicates = await collection
      .aggregate([
        {
          $match: {
            email: { $exists: true, $type: "string", $ne: "" },
          },
        },
        { $group: { _id: "$email", count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();

    // Resolve duplicates by keeping exactly one client with the email.
    // Priority:
    // 1) Client referenced by a user.client relation
    // 2) Earliest createdAt
    // 3) Lowest _id as deterministic fallback
    if (duplicates.length > 0) {
      let clearedCount = 0;
      for (const dup of duplicates) {
        const clients = await collection
          .find(
            { _id: { $in: dup.ids } },
            { projection: { _id: 1, createdAt: 1 } },
          )
          .toArray();

        const linkedUsers = await usersCollection
          .find(
            { client: { $in: dup.ids } },
            { projection: { _id: 1, client: 1 } },
          )
          .toArray();

        const linkedClientIds = new Set(
          linkedUsers
            .map((u) => (u.client && u.client.toString ? u.client.toString() : null))
            .filter(Boolean),
        );

        const sorted = [...clients].sort((a, b) => {
          const aLinked = linkedClientIds.has(a._id.toString()) ? 1 : 0;
          const bLinked = linkedClientIds.has(b._id.toString()) ? 1 : 0;
          if (aLinked !== bLinked) return bLinked - aLinked;

          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : Number.MAX_SAFE_INTEGER;
          if (aCreated !== bCreated) return aCreated - bCreated;

          return a._id.toString().localeCompare(b._id.toString());
        });

        const keeper = sorted[0];
        const toClear = sorted.slice(1).map((c) => c._id);

        if (toClear.length > 0) {
          const res = await collection.updateMany(
            { _id: { $in: toClear } },
            { $unset: { email: "" } },
          );
          clearedCount += res.modifiedCount ?? 0;
          console.log(
            `⚠️ Resolved duplicate email "${dup._id}": kept ${keeper._id.toString()}, cleared email on ${toClear.length} duplicate client(s)`,
          );
        }
      }

      console.log(
        `✅ Duplicate resolution completed for ${duplicates.length} email group(s), cleared ${clearedCount} client email value(s)`,
      );
    }

    // Replace old non-unique index if present
    const indexes = await collection.indexes();
    const existing = indexes.find((i) => i.name === "email_1");
    if (existing) {
      await collection.dropIndex("email_1");
      console.log("🗑️ Dropped existing email_1 index");
    }

    // Remove blank-string emails so they are excluded from unique partial index
    const blankCleanup = await collection.updateMany(
      { email: "" },
      { $unset: { email: "" } },
    );
    if ((blankCleanup.modifiedCount ?? 0) > 0) {
      console.log(`✅ Cleared ${blankCleanup.modifiedCount} blank client email value(s)`);
    }

    await collection.createIndex(
      { email: 1 },
      {
        unique: true,
        partialFilterExpression: {
          email: { $exists: true, $type: "string" },
        },
      },
    );
    console.log("✅ Created unique partial index on clients.email");
  },

  async down(db, client) {
    const collection = db.collection("clients");
    const indexes = await collection.indexes();
    const existing = indexes.find((i) => i.name === "email_1");
    if (existing) {
      await collection.dropIndex("email_1");
      console.log("🗑️ Dropped unique email_1 index");
    }

    await collection.createIndex({ email: 1 });
    console.log("✅ Restored non-unique email_1 index");
  },
};

