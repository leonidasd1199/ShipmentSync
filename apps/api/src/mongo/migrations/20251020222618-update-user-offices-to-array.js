module.exports = {
  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async up(db, client) {
    // Update users to have offices as array instead of single office
    const users = await db.collection("users").find({}).toArray();
    
    for (const user of users) {
      const updateData = {
        offices: user.office ? [user.office] : [],
        officeNames: user.officeName ? [user.officeName] : []
      };
      
      // Remove old single office fields
      const unsetData = {
        office: "",
        officeName: ""
      };
      
      await db.collection("users").updateOne(
        { _id: user._id },
        { 
          $set: updateData,
          $unset: unsetData
        }
      );
    }
    
    // Add some users to multiple offices for demonstration
    const offices = await db.collection("offices").find({}).toArray();
    const officeMap = new Map(offices.map(office => [`${office.companyName}-${office.name}`, office._id]));
    
    // Update John Doe to be in multiple offices
    await db.collection("users").updateOne(
      { email: "john.doe@shipsync.com" },
      { 
        $set: {
          offices: [
            officeMap.get("Meridian Logistics-Headquarters"),
            officeMap.get("Meridian Logistics-Warehouse East")
          ],
          officeNames: ["Headquarters", "Warehouse East"]
        }
      }
    );
    
    // Update Jane Smith to be in multiple offices
    await db.collection("users").updateOne(
      { email: "jane.smith@client.com" },
      { 
        $set: {
          offices: [
            officeMap.get("Global Shipping Ltd-Port Office"),
            officeMap.get("Global Shipping Ltd-Distribution Center")
          ],
          officeNames: ["Port Office", "Distribution Center"]
        }
      }
    );
    
    console.log("✅ Users updated to support multiple offices");
  },

  /**
   * @param db {import('mongodb').Db}
   * @param client {import('mongodb').MongoClient}
   * @returns {Promise<void>}
   */
  async down(db, client) {
    // Revert back to single office structure
    const users = await db.collection("users").find({}).toArray();
    
    for (const user of users) {
      const updateData = {
        office: user.offices && user.offices.length > 0 ? user.offices[0] : null,
        officeName: user.officeNames && user.officeNames.length > 0 ? user.officeNames[0] : null
      };
      
      // Remove array fields
      const unsetData = {
        offices: "",
        officeNames: ""
      };
      
      await db.collection("users").updateOne(
        { _id: user._id },
        { 
          $set: updateData,
          $unset: unsetData
        }
      );
    }
    
    console.log("❌ Users reverted to single office structure");
  }
};
