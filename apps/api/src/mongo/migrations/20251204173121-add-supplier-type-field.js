module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    const collection = db.collection("shippings");
    
    // Check if collection exists
    const collections = await db.listCollections({ name: "shippings" }).toArray();
    if (collections.length === 0) {
      console.log("ℹ️  Shippings collection does not exist, skipping migration");
      return;
    }

    // Rename supplierType to shippingModes if it exists, otherwise add shippingModes with default value
    const documentsWithOldField = await collection.find({
      $or: [
        { supplierType: { $exists: true } },
        { shippingModes: { $exists: false } }
      ]
    }).toArray();

    let renamedCount = 0;
    let addedCount = 0;

    for (const doc of documentsWithOldField) {
      if (doc.supplierType !== undefined) {
        // Rename supplierType to shippingModes
        let shippingModes = [];
        
        if (Array.isArray(doc.supplierType)) {
          // Migrate old enum values in arrays
          shippingModes = doc.supplierType.map((type) => {
            if (type === "terrestrial") return "road";
            if (type === "aerial") return "air";
            if (["maritime", "air", "road"].includes(type)) return type;
            return type; // Keep other values for now
          }).filter(Boolean);
        } else if (typeof doc.supplierType === "string") {
          // Handle string values
          if (doc.supplierType === "terrestrial") {
            shippingModes = ["road"];
          } else if (doc.supplierType === "aerial") {
            shippingModes = ["air"];
          } else if (["maritime", "air", "road"].includes(doc.supplierType)) {
            shippingModes = [doc.supplierType];
          }
        }

        // Ensure at least one value (default to maritime if empty after migration)
        if (shippingModes.length === 0) {
          shippingModes = ["maritime"];
        }

        await collection.updateOne(
          { _id: doc._id },
          { 
            $set: { shippingModes },
            $unset: { supplierType: "" }
          }
        );
        renamedCount++;
      } else if (doc.shippingModes === undefined) {
        // Add shippingModes with default value for documents that don't have it
        await collection.updateOne(
          { _id: doc._id },
          { $set: { shippingModes: ["maritime"] } }
        );
        addedCount++;
      }
    }

    if (renamedCount > 0) {
      console.log(`✅ Renamed supplierType to shippingModes for ${renamedCount} document(s)`);
    }
    if (addedCount > 0) {
      console.log(`✅ Added shippingModes field to ${addedCount} document(s)`);
    }

    // Validate all documents have shippingModes with at least one value
    const invalidDocs = await collection.find({
      $or: [
        { shippingModes: { $exists: false } },
        { shippingModes: { $size: 0 } },
        { shippingModes: null },
        { shippingModes: [] }
      ]
    }).toArray();

    if (invalidDocs.length > 0) {
      for (const doc of invalidDocs) {
        await collection.updateOne(
          { _id: doc._id },
          { $set: { shippingModes: ["maritime"] } }
        );
      }
      console.log(`✅ Fixed ${invalidDocs.length} document(s) with invalid shippingModes (set to default: ["maritime"])`);
    }

    // Create index for shippingModes if it doesn't exist
    const existingIndexes = await collection.indexes();
    const indexExists = existingIndexes.some(
      (index) => index.name === "shippingModes_1" || 
                 (index.key && index.key.shippingModes === 1)
    );

    if (!indexExists) {
      await collection.createIndex({ shippingModes: 1 });
      console.log("✅ Created index on shippingModes field");
    } else {
      console.log("ℹ️  Index on shippingModes already exists, skipping");
    }

    // Drop old supplierType index if it exists
    try {
      await collection.dropIndex("supplierType_1");
      console.log("✅ Dropped old index on supplierType field");
    } catch (error) {
      if (error.codeName === "IndexNotFound") {
        console.log("ℹ️  Old index on supplierType does not exist, skipping");
      } else {
        // Ignore other errors
      }
    }

    console.log("✅ Migration completed: shippingModes field added/renamed in shippings collection");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    const collection = db.collection("shippings");
    
    // Check if collection exists
    const collections = await db.listCollections({ name: "shippings" }).toArray();
    if (collections.length === 0) {
      console.log("ℹ️  Shippings collection does not exist, skipping rollback");
      return;
    }

    // Rename shippingModes back to supplierType
    const docsToRename = await collection.find({ shippingModes: { $exists: true } }).toArray();
    let renamedCount = 0;
    
    for (const doc of docsToRename) {
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: { supplierType: doc.shippingModes },
          $unset: { shippingModes: "" }
        }
      );
      renamedCount++;
    }
    
    console.log(`✅ Renamed shippingModes back to supplierType for ${renamedCount} shipping document(s)`);

    // Drop shippingModes index if it exists
    try {
      await collection.dropIndex("shippingModes_1");
      console.log("✅ Dropped index on shippingModes field");
    } catch (error) {
      if (error.codeName === "IndexNotFound") {
        console.log("ℹ️  Index on shippingModes does not exist, skipping");
      } else {
        throw error;
      }
    }

    console.log("✅ Rollback completed: shippingModes field renamed back to supplierType");
  }
};
