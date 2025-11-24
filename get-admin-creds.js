const Redis = require('ioredis');

const redis = new Redis({
  host: '5.78.116.125',
  port: 6379,
  retryStrategy: () => null,
  maxRetriesPerRequest: 1
});

async function getAdminCredentials() {
  try {
    console.log('Conectando a Redis...');

    // Intentar obtener credenciales de admin
    const adminCreds = await redis.hgetall('session:admin_credentials');

    if (adminCreds && Object.keys(adminCreds).length > 0) {
      console.log('\n✅ Credenciales de admin encontradas:');
      console.log(JSON.stringify(adminCreds, null, 2));
    } else {
      console.log('\n❌ No se encontraron credenciales en Redis');

      // Buscar todas las claves relacionadas con admin
      console.log('\nBuscando claves relacionadas con admin...');
      const keys = await redis.keys('*admin*');
      console.log('Claves encontradas:', keys);

      if (keys.length > 0) {
        for (const key of keys) {
          const type = await redis.type(key);
          console.log(`\nClave: ${key} (tipo: ${type})`);

          if (type === 'hash') {
            const data = await redis.hgetall(key);
            console.log('Datos:', JSON.stringify(data, null, 2));
          } else if (type === 'string') {
            const data = await redis.get(key);
            console.log('Valor:', data);
          }
        }
      }
    }

    redis.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    redis.disconnect();
    process.exit(1);
  }
}

getAdminCredentials();
