'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const instanceMap = {};
exports.default = {
    register: (instanceKey) => {
        instanceMap[instanceKey] = {};
    },
    upsert: (instanceKey, keyValuePairs) => {
        Object.entries(keyValuePairs).forEach(([key, value]) => {
            instanceMap[instanceKey][key] = value;
        });
    },
    get: (instanceKey, detailKeys) => {
        const requestedDetails = {};
        detailKeys.forEach((key) => {
            requestedDetails[key] = instanceMap[instanceKey][key];
        });
        return requestedDetails;
    }
};
