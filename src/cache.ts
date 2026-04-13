import { LRUCache } from "lru-cache";
import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";

export const TTL_MS = {
  COMPANY: 24 * 60 * 60 * 1000,
  DIRECTORS: 24 * 60 * 60 * 1000,
  GST: 6 * 60 * 60 * 1000,
  PAN: 7 * 24 * 60 * 60 * 1000,
  UDYAM: 12 * 60 * 60 * 1000,
} as const;

export type CacheType = keyof typeof TTL_MS;

const mem = new LRUCache<string, { data: unknown; expires: number }>({ max: 500 });

export function getMemCached<T>(key: string): T | null {
  const entry = mem.get(key);
  if (!entry || Date.now() > entry.expires) {
    mem.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setMemCached<T>(key: string, data: T, type: CacheType): void {
  mem.set(key, { data, expires: Date.now() + TTL_MS[type] });
}

const dynamo =
  process.env.DISABLE_DYNAMO_CACHE === "true"
    ? null
    : new DynamoDBClient({ region: process.env.REGION ?? "ap-south-1" });

export async function getDynamoCached<T>(key: string): Promise<T | null> {
  if (!dynamo) return null;
  try {
    const res = await dynamo.send(
      new GetItemCommand({
        TableName: process.env.CACHE_TABLE_NAME ?? "bizverify-cache",
        Key: { pk: { S: key } },
      })
    );
    if (!res.Item?.data?.S) return null;
    return JSON.parse(res.Item.data.S) as T;
  } catch {
    return null;
  }
}

export async function setDynamoCached<T>(key: string, data: T, type: CacheType): Promise<void> {
  if (!dynamo) return;
  const ttlSeconds = Math.floor((Date.now() + TTL_MS[type]) / 1000);
  try {
    await dynamo.send(
      new PutItemCommand({
        TableName: process.env.CACHE_TABLE_NAME ?? "bizverify-cache",
        Item: {
          pk: { S: key },
          data: { S: JSON.stringify(data) },
          ttl: { N: ttlSeconds.toString() },
        },
      })
    );
  } catch {
    /* cache write failure is non-fatal */
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  const memResult = getMemCached<T>(key);
  if (memResult) return memResult;
  return getDynamoCached<T>(key);
}

export async function setCached<T>(key: string, data: T, type: CacheType): Promise<void> {
  setMemCached(key, data, type);
  await setDynamoCached(key, data, type);
}

export function cacheKey(tool: string, ...parts: string[]): string {
  return `bv:${tool}:${parts.join(":")}`;
}
