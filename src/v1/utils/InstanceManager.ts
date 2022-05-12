'use strict';

import { createClient, RedisClientType } from 'redis';

const instanceMap: Record<string , Partial<IMap>> = {};
let redisClient: RedisClientType;
function debug(instanceKey: string) {
  console.log(instanceMap[instanceKey]);
}

function removeEmpty(obj: Partial<Record<MapKey, any>>) {
  return Object.entries(obj)
    .filter(([_, v]) => v != null)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
}

const NESTED_FILE_DETAILS_FIELD = 'fileDetails';

export default {
  connectToRedisServer: async () => {
    const client: RedisClientType = createClient({
      url: process.env.REDIS_URL,
    });
    redisClient = client;
    await redisClient.connect();
  },

  register: (instanceKey: string) => {
    redisClient.hSet(instanceKey, {});
  },

  checkRegistration: async (instanceKeyOrOrgUrl: string): Promise<boolean> => {
    return !! await redisClient.exists(instanceKeyOrOrgUrl);
  },

  upsert: async (instanceKey: string, keyValuePairs: Partial<Record<MapKey, any>>) => {
    try {
      await redisClient.hSet(instanceKey, removeEmpty(keyValuePairs));
    } catch (err) {
      debug(instanceKey);
      throw new Error(`Failed to update InstanceManager: ${JSON.stringify(keyValuePairs)}`);
    }
  },

  get: async (instanceKey: string, detailKeys: MapKey[]): Promise<Partial<Record<string, any>>> => {
    try {
      const requestedDetails: Partial<Record<string, any>> = {};
      const redisResult: Record<string, string> = await redisClient.hGetAll(instanceKey);

      detailKeys.forEach((key: string) => {
        if (key == NESTED_FILE_DETAILS_FIELD) {
          redisResult[NESTED_FILE_DETAILS_FIELD] = JSON.parse(redisResult[NESTED_FILE_DETAILS_FIELD])
        }
        requestedDetails[key] = redisResult[key];
      })

      return requestedDetails;
    } catch (err) {
      console.log(err);
      debug(instanceKey);
      throw new Error(`InstanceManager does not contain requested keys:
        ${detailKeys.join(', ')}
      `);
    }
  }
};