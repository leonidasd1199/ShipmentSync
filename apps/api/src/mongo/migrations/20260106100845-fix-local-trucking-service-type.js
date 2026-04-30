module.exports = {
  async up(db) {
    const result = await db.collection('templates').updateMany(
      { serviceType: 'LOCAL TRUCKING' },
      { $set: { serviceType: 'LOCAL_TRUCKING' } }
    );
    console.log(`Templates updated: ${result.modifiedCount}`);
  },

  async down(db) {
    await db.collection('templates').updateMany(
      { serviceType: 'LOCAL_TRUCKING' },
      { $set: { serviceType: 'LOCAL TRUCKING' } }
    );
  }
};