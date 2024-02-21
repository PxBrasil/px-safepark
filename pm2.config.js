module.exports = {
    apps: [
      {
        name: 'integra-ts',
        script: 'server.mjs', // Caminho para o arquivo 
        interpreter: 'node',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '2G',
        env: {
          NODE_ENV: 'development',
        },
        env_production: {
          NODE_ENV: 'production',
        },
      },
    ],
  };