"use strict"
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
        const instanceKey = Date.now.toString() + sessionId;
        instanceMap[instanceKey] = {};
        return instanceKey;
    },

    add: (instanceKey, detailKey, detailValue) => {
        instanceMap[instanceKey][detailKey] = detailValue;
    },

    get: (instanceKey, ...detailKeys) => {
        const requestedDetails = {};
        detailKeys.forEach(key => requestedDetails[key] = instanceMap[instanceKey][key]);
        return requestedDetails;
    }
}