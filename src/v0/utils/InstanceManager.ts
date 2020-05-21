'use strict';

// import { cloneDeep } from 'lodash';

const instanceMap: Record<string , Partial<IMap>> = {};

export default {
  register: (instanceKey: string) => {
    instanceMap[instanceKey] = {};
  },

  upsert: (instanceKey: string, keyValuePairs: Partial<Record<MapKey, any>>) => {
    Object.entries(keyValuePairs).forEach(([key, value]) => {
      instanceMap[instanceKey][<MapKey> key] = value;
    });
  },

  get: (instanceKey: string, detailKeys: MapKey[]) => {
    const requestedDetails: Record<string ,any> = {};
    detailKeys.forEach((key: MapKey) => {
      requestedDetails[key] = instanceMap[instanceKey][key];
    });
    return requestedDetails;
  },

  // getRef: (instanceKey: string, key: MapKey) => {
  //   const requestedDetails: Record<string ,any> = {};
  //   requestedDetails[key] = instanceMap[instanceKey][key];
  //   return requestedDetails;
  // },

  // upsert: (instanceKey: string, key: MapKey, value: any) => {
  //   instanceMap[instanceKey][key] = value //uses same object in memory
  // },
};
