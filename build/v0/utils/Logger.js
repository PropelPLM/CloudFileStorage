'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatform = exports.logProgressResponse = exports.logErrorResponse = exports.logSuccessResponse = void 0;
const GoogleDrive_1 = __importDefault(require("../platforms/GoogleDrive/GoogleDrive"));
const Office365_1 = __importDefault(require("../platforms/Office365/Office365"));
const logSuccessResponse = (response, functionName) => {
    const logEnding = Object.entries(response).length === 0 && response.constructor === Object
        ? ''
        : `: ${JSON.stringify(response)}`;
    console.log(`\x1b[92m${functionName} succeeded \x1b[39m with a response${logEnding}.`);
    return response;
};
exports.logSuccessResponse = logSuccessResponse;
const logErrorResponse = (err, functionName) => {
    console.log(`\x1b[31m${functionName} failed \x1b[39m due to error: ${JSON.stringify(err)}.`);
    return err;
};
exports.logErrorResponse = logErrorResponse;
const logProgressResponse = (fileName, src, progress) => {
    console.log(`[${fileName}][${src}_UPLOAD]: ${progress}`);
};
exports.logProgressResponse = logProgressResponse;
const getPlatform = (platform) => {
    let returnPlatform;
    switch (platform.toLowerCase()) {
        case 'googledrive':
            returnPlatform = GoogleDrive_1.default;
            break;
        case 'office365':
            returnPlatform = Office365_1.default;
            break;
        default:
            throw new Error('Platform not specified.');
    }
    return returnPlatform;
};
exports.getPlatform = getPlatform;
