const CACHE_TTL_DEFAULT = 60;

let _redisClient = null;
let _memoryStore = new Map();
let _memoryTimers = new Map();

function hasRedisEnv() {
  return Boolean(process.env.REDIS_URL);
}

async function getRedisClient() {
  if (_redisClient !== null || _redisClient === false) return _redisClient;
  if (!hasRedisEnv()) {
    _redisClient = false;
    return null;
  }
  try {
    const ioredisPkg = await import('ioredis').catch(() => null);
    if (!ioredisPkg?.default && !ioredisPkg?.Redis) {
      console.warn('[Cache] REDIS_URL set but ioredis not installed. Using in-memory cache.');
      _redisClient = false;
      return null;
    }
    const Redis = ioredisPkg.default || ioredisPkg.Redis;
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    client.on('error', (err) => {
      console.error('[Cache] Redis error:', err?.message || err);
    });
    await client.connect().catch(() => null);
    _redisClient = client;
    console.log('[Cache] Redis client ready');
    return client;
  } catch (e) {
    console.warn('[Cache] Redis init failed, using in-memory. Error:', e?.message);
    _redisClient = false;
    return null;
  }
}

function memoryCleanup(key) {
  _memoryStore.delete(key);
  _memoryTimers.delete(key);
}

export async function cacheGet(key) {
  try {
    const client = await getRedisClient();
    if (client) {
      const raw = await client.get(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
  } catch (e) {
    console.warn('[Cache] cacheGet redis failed:', e?.message);
  }
  if (_memoryStore.has(key)) return _memoryStore.get(key);
  return null;
}

export async function cacheSet(key, value, ttlSec = CACHE_TTL_DEFAULT) {
  const ttl = Math.max(1, Number(ttlSec) || CACHE_TTL_DEFAULT);
  try {
    const client = await getRedisClient();
    if (client) {
      const payload = typeof value === 'string' ? value : JSON.stringify(value);
      await client.set(key, payload, 'EX', ttl);
      return true;
    }
  } catch (e) {
    console.warn('[Cache] cacheSet redis failed:', e?.message);
  }
  _memoryStore.set(key, value);
  if (_memoryTimers.has(key)) clearTimeout(_memoryTimers.get(key));
  const timer = setTimeout(() => memoryCleanup(key), ttl * 1000);
  _memoryTimers.set(key, timer);
  return true;
}

export async function cacheDel(key) {
  try {
    const client = await getRedisClient();
    if (client) {
      await client.del(key);
    }
  } catch (e) {
    console.warn('[Cache] cacheDel redis failed:', e?.message);
  }
  if (_memoryStore.has(key)) memoryCleanup(key);
  return true;
}

export async function cacheDelPattern(prefix) {
  let count = 0;
  try {
    const client = await getRedisClient();
    if (client) {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', prefix + '*', 'COUNT', 200);
        cursor = nextCursor;
        if (keys.length) await client.del(...keys);
        count += keys.length;
      } while (cursor !== '0');
      return count;
    }
  } catch (e) {
    console.warn('[Cache] cacheDelPattern redis failed:', e?.message);
  }
  const keysToDelete = [];
  for (const k of _memoryStore.keys()) {
    if (k.startsWith(prefix)) keysToDelete.push(k);
  }
  for (const k of keysToDelete) memoryCleanup(k);
  return keysToDelete.length;
}

export const cacheInfo = () => ({
  redis: hasRedisEnv(),
  memoryKeys: _memoryStore.size,
});
