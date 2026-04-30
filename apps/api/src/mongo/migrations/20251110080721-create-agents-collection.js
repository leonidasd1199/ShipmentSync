module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Create agents collection only if it doesn't exist
    const collections = await db.listCollections({ name: "agents" }).toArray();
    if (collections.length === 0) {
      await db.createCollection("agents");
      console.log("✅ Created agents collection");
    } else {
      console.log("ℹ️  Agents collection already exists, skipping creation");
    }
    
    const collection = db.collection("agents");
    const existingIndexes = await collection.indexes();

    const ensureIndex = async (key, options = {}) => {
      const indexName = options.name || Object.keys(key).map(k => `${k}_${key[k]}`).join("_");
      const exists = existingIndexes.some(i => i.name === indexName);
      if (!exists) {
        await collection.createIndex(key, options);
        console.log(`✅ Created index: ${indexName}`);
      } else {
        console.log(`ℹ️ Index ${indexName} already exists, skipping`);
      }
    };

    // Create indexes for agents collection
    await ensureIndex({ email: 1 }, { unique: true });
    await ensureIndex({ shippingLineId: 1 });
    await ensureIndex({ firstName: 1, lastName: 1 });
    await ensureIndex({ isActive: 1 }, {});
    await ensureIndex({ createdAt: -1 }, {});

    // Insert sample agent data
    const count = await collection.countDocuments();
    if (count === 0) {
      await collection.insertOne({
        firstName: "Juan",
        lastName: "Ramírez",
        email: "juan@agencia.com",
        phone: "+504 9999-9999",
        whatsapp: "+504 8888-8888",
        address: {
          street: "Blvd. del Sur",
          city: "San Pedro Sula",
          country: "Honduras",
        },
        notes: "Agente operativo en Puerto Cortés.",
        shippingLineId: "507f1f77bcf86cd799439011", // MongoDB ObjectId example
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log("✅ Inserted sample agent data");
    } else {
      console.log("ℹ️  Agents collection already has data, skipping seed");
    }
    
    console.log("✅ Agents collection created with indexes");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove agents collection
    await db.collection("agents").drop();
    console.log("❌ Agents collection dropped");
  }
};

