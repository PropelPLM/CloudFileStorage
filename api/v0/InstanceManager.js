'use strict';
const { cloneDeep } = require('lodash');

/**
 * Time of access and the sessionId will be used to demultiplex different iframe sessions
 * SessionID: allows different users to use the this app at the same time
 * Time of Access: differentiates iframe sessions spawned by different pages by the same user
 *  - especially important for revIds, destination folders
 * connection, salesforceUrl, orgNamespace
 */

const instanceMap = {};

module.exports = {
  register: (instanceKey) => {
    instanceMap[instanceKey] = {};
  },

  add: (instanceKey, keyValuePairs) => {
    Object.entries(keyValuePairs).forEach(([key, value]) => {
      instanceMap[instanceKey][key] = cloneDeep(value);
    });
  },

  get: (instanceKey, detailKeys) => {
    const requestedDetails = {};
    detailKeys.forEach((key) => {
      requestedDetails[key] = cloneDeep(instanceMap[instanceKey][key]);
    });
    return requestedDetails;
  },

  memRef: (instanceKey, key, value) => {
    instanceMap[instanceKey][key] = value 
  },

  update: (instanceKey, field, value) => {
    instanceMap[instanceKey][field] = value //uses same object in memory
  },
};
