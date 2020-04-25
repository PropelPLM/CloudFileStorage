"use strict"
const _ = require("lodash");
/**
 * Time of access and the sessionId will be used to demultiplex different iframe sessions
 * SessionID: allows different users to use the this app at the same time
 * Time of Access: differentiates iframe sessions spawned by different pages by the same user
 *  - especially important for revIds, destination folders
 * connection, salesforceUrl, namespace
 */

const instanceMap = {}

module.exports = {
    start: (sessionId) => {
        const instanceKey = _.replace(sessionId, /\./g, "");
        instanceMap[instanceKey] = {};
        return instanceKey;
    },

    startWithRevId: (sessionId, revisionId) => {
        let instanceKey = sessionId + revisionId;
        instanceKey = _.replace(instanceKey, /\./g, "");
        instanceMap[instanceKey] = {};
        return instanceKey;
    },

    add: (instanceKey, keyValuePairs) => {
        Object.entries(keyValuePairs).forEach(([key, value]) => {
            instanceMap[instanceKey][key] = _.cloneDeep(value);
        })
    },

    get: (instanceKey, ...detailKeys) => {
        const requestedDetails = {};
        detailKeys.forEach(key => requestedDetails[key] = instanceMap[instanceKey][key]);
        return requestedDetails;
    }
}