'use strict';

import { createClient, RedisClientType } from 'redis';
import { logErrorResponse, logSuccessResponse } from './Logger';

let redisClient: RedisClientType;

function removeEmpty(obj: Partial<Record<MapKey, any>>) {
    return Object.entries(obj)
        .filter(([_, v]) => v != null)
        .reduce((acc, [k, v]) => {
            return {
                ...acc,
                [k]: typeof v != 'string' ? JSON.stringify(v) : v
            };
        }, {});
}

const NESTED_FILE_DETAILS_FIELD = 'fileDetails';

export default {
    connectToRedisServer: async () => {
        const client: RedisClientType = createClient({
            url: process.env.REDIS_URL
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
            const dbItemsToCommit = removeEmpty(keyValuePairs);
            if (!Object.values(dbItemsToCommit || {}).length) return;
            await redisClient.hSet(instanceKey, dbItemsToCommit);
            logSuccessResponse(dbItemsToCommit, '[DB.UPSERT');
        } catch (error) {
            logErrorResponse(error, '[DB.UPSERT');
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

            logSuccessResponse(requestedDetails, '[DB.GET]');
            return requestedDetails;
        } catch (err) {
            logErrorResponse(err, '[DB.GET]');
            throw new Error(`InstanceManager does not contain requested keys:
        ${detailKeys.join(', ')}
      `);
        }
    }
};
