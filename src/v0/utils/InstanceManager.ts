'use strict';

const instanceMap: Record<string , Partial<IMap>> = {};
function debug(instanceKey:string) {
  console.log(instanceMap[instanceKey]);
}


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
    try {
      const requestedDetails: Record<string ,any> = {};
      detailKeys.forEach((key: MapKey) => {
        requestedDetails[key] = instanceMap[instanceKey][key];
      });
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
