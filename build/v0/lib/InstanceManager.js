'use strict';
const { cloneDeep } = require('lodash');
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
    addRef: (instanceKey, key, value) => {
        instanceMap[instanceKey][key] = value;
    },
    get: (instanceKey, detailKeys) => {
        const requestedDetails = {};
        detailKeys.forEach((key) => {
            requestedDetails[key] = cloneDeep(instanceMap[instanceKey][key]);
        });
        return requestedDetails;
    },
    getRef: (instanceKey, key) => {
        const requestedDetails = {};
        requestedDetails[key] = instanceMap[instanceKey][key];
        return requestedDetails;
    },
    update: (instanceKey, key, value) => {
        instanceMap[instanceKey][key] = value;
    },
};
