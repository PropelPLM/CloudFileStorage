'use strict';
module.exports = {
    logSuccessResponse: function (response, functionName) {
        var logEnding = Object.entries(response).length === 0 && response.constructor === Object
            ? ''
            : ": " + JSON.stringify(response);
        console.log("\u001B[92m" + functionName + " succeeded \u001B[39m with a response" + logEnding + ".");
        return response;
    },
    logErrorResponse: function (error, functionName) {
        console.log("\u001B[31m" + functionName + " failed \u001B[39m due to error: " + JSON.stringify(error) + ".");
        return error;
    },
};
