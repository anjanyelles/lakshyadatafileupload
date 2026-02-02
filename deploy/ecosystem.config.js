module.exports = {
  apps: [
    {
      name: "recruitment-api",
      script: "server/server.js",
      cwd: "/var/www/recruitment-db",
      env: {
        NODE_ENV: "production",
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "500M",
    },
  ],
};
