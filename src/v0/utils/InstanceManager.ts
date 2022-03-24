'use strict';

const instanceMap: Record<string , Partial<IMap>> = {};

export default {
  register: (instanceKey: string) => {
    instanceMap[instanceKey] = {};
  },

  checkRegistration: (instanceKeyOrOrgUrl: string): boolean => {
    return instanceMap.hasOwnProperty(instanceKeyOrOrgUrl);
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

  debug: (instanceKey:string) => {
    return instanceMap[instanceKey];;
  }
};
