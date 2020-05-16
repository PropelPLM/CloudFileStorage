'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.logErrorResponse = exports.logSuccessResponse = void 0;
exports.logSuccessResponse = function (response, functionName) {
    var logEnding = Object.entries(response).length === 0 && response.constructor === Object
        ? ''
        : ": " + JSON.stringify(response);
    console.log("\u001B[92m" + functionName + " succeeded \u001B[39m with a response" + logEnding + ".");
    return response;
};
exports.logErrorResponse = function (error, functionName) {
    console.log("\u001B[31m" + functionName + " failed \u001B[39m due to error: " + JSON.stringify(error) + ".");
    return error;
};
