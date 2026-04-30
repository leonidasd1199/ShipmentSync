module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Add lastPasswordResetAt field to users collection (optional field, no default)
    // This field will be set when users change their password
    // Note: companyId field is not needed as 'company' field already exists as ObjectId reference
    await db.collection("users").updateMany(
      { lastPasswordResetAt: { $exists: false } },
      { $set: { lastPasswordResetAt: null } }
    );
    
    console.log("✅ Added lastPasswordResetAt field to users collection");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove lastPasswordResetAt field from all users
    await db.collection("users").updateMany(
      {},
      { $unset: { lastPasswordResetAt: "" } }
    );
    
    console.log("❌ Removed lastPasswordResetAt field from users collection");
  }
};

