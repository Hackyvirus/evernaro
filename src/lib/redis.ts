import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: IORedis | undefined };

export const redisConnection =
  globalForRedis.redis ??
  new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
    maxRetriesPerRequest: null, // required by BullMQ
    lazyConnect: true, // don't connect during build/static generation
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redisConnection;
