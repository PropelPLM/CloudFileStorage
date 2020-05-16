'use strict';
var cloneDeep = require('lodash').cloneDeep;
var instanceMap = {};
module.exports = {
    register: function (instanceKey) {
        instanceMap[instanceKey] = {};
    },
    add: function (instanceKey, keyValuePairs) {
        Object.entries(keyValuePairs).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            instanceMap[instanceKey][key] = cloneDeep(value);
        });
    },
    addRef: function (instanceKey, key, value) {
        instanceMap[instanceKey][key] = value;
    },
    get: function (instanceKey, detailKeys) {
        var requestedDetails = {};
        detailKeys.forEach(function (key) {
            requestedDetails[key] = cloneDeep(instanceMap[instanceKey][key]);
        });
        return requestedDetails;
    },
    getRef: function (instanceKey, key) {
        var requestedDetails = {};
        requestedDetails[key] = instanceMap[instanceKey][key];
        return requestedDetails;
    },
    update: function (instanceKey, key, value) {
        instanceMap[instanceKey][key] = value;
    },
};
