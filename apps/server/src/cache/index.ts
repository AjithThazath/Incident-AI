

import { getRedisClient } from "../config/providers";

export async function getFromCache(_key: string): Promise<unknown | null> {

  const redis = await getRedisClient();
  const cache = await redis.get(_key);
  return cache ? JSON.parse(cache) : null;
  
}

export async function setInCache(_key: string, _value: unknown, _ttlSeconds?: number): Promise<void> {
  const redis = await getRedisClient();
  await redis.set(_key, JSON.stringify(_value), { EX: _ttlSeconds || 3600});
}
