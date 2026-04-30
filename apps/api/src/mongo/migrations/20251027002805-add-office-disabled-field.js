module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Add office_disabled field to all users with default value false
    await db.collection("users").updateMany(
      { office_disabled: { $exists: false } },
      { $set: { office_disabled: false } }
    );
    
    console.log("✅ Added office_disabled field to users collection");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Remove office_disabled field from all users
    await db.collection("users").updateMany(
      {},
      { $unset: { office_disabled: "" } }
    );
    
    console.log("❌ Removed office_disabled field from users collection");
  }
};
