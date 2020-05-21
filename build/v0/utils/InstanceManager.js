'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_1 = require("lodash");
var instanceMap = {};
exports.default = {
    register: function (instanceKey) {
        instanceMap[instanceKey] = {};
    },
    upsert: function (instanceKey, keyValuePairs) {
        Object.entries(keyValuePairs).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            instanceMap[instanceKey][key] = value;
        });
    },
    get: function (instanceKey, detailKeys) {
        var requestedDetails = {};
        detailKeys.forEach(function (key) {
            requestedDetails[key] = lodash_1.cloneDeep(instanceMap[instanceKey][key]);
        });
        return requestedDetails;
    },
};
