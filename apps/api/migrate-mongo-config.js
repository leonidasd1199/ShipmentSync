module.exports = {
  mongodb: {
    url: process.env.MONGODB_URI || "mongodb://localhost:27017",
    databaseName: process.env.MONGODB_DB || "shipsync",
    options: {},
  },

  migrationsDir: "src/mongo/migrations",
  changelogCollectionName: "changelog",

  // important bits:
  migrationTemplate: "javascript",
  migrationFileExtension: ".js",
  moduleSystem: "commonjs",
  useFileHash: false,
};
