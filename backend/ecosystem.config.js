module.exports = {
  apps: [
    {
      name: "sfa-co-control",
      script: "./index.js",
      watch: true,
      ignore_watch: [
        "node_modules",
        "uploads",
        "public/uploads",
        "*.db",
        "*.db-journal"
      ]
    }
  ]
};
