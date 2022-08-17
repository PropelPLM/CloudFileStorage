'use strict';

import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType;

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
        client.on('error', (err) => console.error('Redis client error:', err));
        redisClient = client;
        await redisClient.connect();
    },

    register: (instanceKey: string) => {
        console.log(`register ${instanceKey}`);
        // redisClient.hSet(instanceKey, {});
    },

    checkRegistration: async (
        instanceKeyOrOrgUrl: string
    ): Promise<boolean> => {
        return !!(await redisClient.exists(instanceKeyOrOrgUrl));
    },

    upsert: async (
        instanceKey: string,
        keyValuePairs: Partial<Record<MapKey, any>>
    ) => {
        try {
            await redisClient.hSet(instanceKey, removeEmpty(keyValuePairs));
        } catch (error) {
            throw new Error(
                `Failed to update ${instanceKey} in InstanceManager: ${JSON.stringify(
                    keyValuePairs
                )}. Error: ${error}`
            );
        }
    },

    get: async (
        instanceKey: string,
        detailKeys: MapKey[]
    ): Promise<Partial<Record<string, any>>> => {
        try {
            const requestedDetails: Partial<Record<string, any>> = {};
            const redisResult: Record<string, string> =
                await redisClient.hGetAll(instanceKey);

            detailKeys.forEach((key: string) => {
                if (key == NESTED_FILE_DETAILS_FIELD) {
                    redisResult[NESTED_FILE_DETAILS_FIELD] = JSON.parse(
                        redisResult[NESTED_FILE_DETAILS_FIELD]
                    );
                }
                requestedDetails[key] = redisResult[key];
            });

            return requestedDetails;
        } catch (err) {
            console.log(err);
            throw new Error(`InstanceManager does not contain requested keys:
        ${detailKeys.join(', ')}
      `);
        }
    },
};
