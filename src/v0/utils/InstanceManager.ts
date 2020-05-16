'use strict';

import { cloneDeep } from 'lodash';

/**
 * Time of access and the sessionId will be used to demultiplex different iframe sessions
 * SessionID: allows different users to use the this app at the same time
 * Time of Access: differentiates iframe sessions spawned by different pages by the same user
 *  - especially important for revIds, destination folders
 * connection, salesforceUrl, orgNamespace
 */

const instanceMap: Record<string ,any> = {};

export default {
  register: (instanceKey: string) => {
    instanceMap[instanceKey] = {};
  },

  add: (instanceKey: string, keyValuePairs: Record<string ,any>) => {
    Object.entries(keyValuePairs).forEach(([key, value]) => {
      instanceMap[instanceKey][key] = cloneDeep(value);
    });
  },

  addRef: (instanceKey: string, key: string, value: any) => {
    instanceMap[instanceKey][key] = value
  },

  get: (instanceKey: string, detailKeys: Record<string ,any>) => {
    const requestedDetails: Record<string ,any> = {};
    detailKeys.forEach((key: string) => {
      requestedDetails[key] = cloneDeep(instanceMap[instanceKey][key]);
    });
    return requestedDetails;
  },

  getRef: (instanceKey: string, key: string) => {
    const requestedDetails: Record<string ,any> = {};
    requestedDetails[key] = instanceMap[instanceKey][key];
    return requestedDetails;
  },

  update: (instanceKey: string, key: string, value: any) => {
    instanceMap[instanceKey][key] = value //uses same object in memory
  },
};
