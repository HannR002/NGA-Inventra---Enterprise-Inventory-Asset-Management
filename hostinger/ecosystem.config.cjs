// Hostinger PM2 Process Manager Configuration
// File: hostinger/ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'nga-inventra',
      script: 'server.js',
      interpreter: 'node',
      instances: 1, // Single instance recommended for inventory consistency
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        // DATABASE_URL and JWT_SECRET will be loaded from .env file
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      merge_logs: true,
    },
  ],
};
