"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const Logger_1 = require("../utils/Logger");
const OFFICE_365 = 'office365';
router.post('/testLock', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, resourcesToTestLock;
    ({ platform, salesforceUrl, resourcesToTestLock } = res.locals);
    try {
        if (platform.toLowerCase() == OFFICE_365) {
            const result = yield Logger_1.getPlatform(platform).testLock(salesforceUrl, resourcesToTestLock);
            Logger_1.logSuccessResponse(result, `[${platform}.TEST_LOCK]`);
            res.status(200).send(result);
        }
    }
    catch (err) {
        Logger_1.logErrorResponse(err, `[${platform}.TEST_LOCK]`);
        res.status(400).send(`Failed to test the locking status of a file (via renaming): ${err}`);
    }
}));
router.post('/create', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, type, fileName, destinationFolderId;
    ({ platform, salesforceUrl, type, fileName, destinationFolderId } = res.locals);
    try {
        const result = yield Logger_1.getPlatform(platform).createFile(salesforceUrl, type, fileName, destinationFolderId);
        Logger_1.logSuccessResponse(result, `[${platform}.CREATE_FILE]`);
        res.status(200).send(result);
    }
    catch (err) {
        Logger_1.logErrorResponse(err, `[${platform}.CREATE_FILE]`);
        res.status(400).send(`Failed to create: ${err}`);
    }
}));
router.post('/get', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, fileOptions;
    ({ platform, salesforceUrl, fileOptions } = res.locals);
    const logMessage = `[${platform}.GET_FILE]`;
    const response = {};
    const errorResults = [];
    let fileIds = fileOptions['fileIds'];
    for (const fileId of fileIds) {
        try {
            const result = yield Logger_1.getPlatform(platform).getFile(salesforceUrl, fileId);
            response[fileId] = result;
            Logger_1.logSuccessResponse(result, logMessage);
        }
        catch (error) {
            Logger_1.logErrorResponse(error, logMessage);
            errorResults.push(fileId);
        }
    }
    if (errorResults.length > 0) {
        res.status(400).send([`Could not get all files: ${errorResults.join(',')}`]);
    }
    else {
        res.status(200).send(response);
    }
}));
router.post('/search', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, searchStrings;
    ({ platform, salesforceUrl, searchStrings } = res.locals);
    const errorResults = [];
    const response = {};
    for (const searchString of searchStrings) {
        try {
            const result = yield Logger_1.getPlatform(platform).searchFile(salesforceUrl, searchString);
            Logger_1.logSuccessResponse(result, `[${platform}.SEARCH_FILE]`);
            response[searchString] = result;
        }
        catch (err) {
            Logger_1.logErrorResponse(err, `[${platform}.SEARCH_FILE]`);
            errorResults.push(searchString);
        }
    }
    if (Object.keys(response).length > 0) {
        res.status(200).send(response);
    }
    else {
        res.status(400).send({
            message: `Did not retrieve any search results for file names: ${errorResults.join(',')}`
        });
    }
}));
router.post('/supersede', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, fileTypes, fileNames, docIds, numSuperseded;
    ({ platform, salesforceUrl, fileTypes, fileNames, docIds, numSuperseded } = res.locals);
    const platformType = yield Logger_1.getPlatform(platform);
    let resultArray = [];
    var i = 0;
    while (i < numSuperseded) {
        try {
            const result = yield platformType.supersedeFile(salesforceUrl, fileTypes[i], fileNames[i], docIds[i]);
            Logger_1.logSuccessResponse(result, `[${platform}.SUPERSEDE_FILE] at index ${i}`);
            resultArray.push(result);
        }
        catch (err) {
            Logger_1.logErrorResponse(err, `[${platform}.SUPERSEDE_FILE] at index ${i}`);
        }
        i++;
    }
    if (resultArray.length !== numSuperseded) {
        res.status(400).send([`Failed to supersede at least one file: please try again.`]);
    }
    else {
        Logger_1.logSuccessResponse(resultArray, `[${platform}.SUPERSEDE_FILE]`);
        const finalResult = { "recordArray": resultArray };
        res.status(200).send(finalResult);
    }
}));
router.post('/clone', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, fileOptions;
    ({ platform, salesforceUrl, fileOptions } = res.locals);
    const errorResults = [];
    const response = {};
    for (const fileId in fileOptions) {
        try {
            if (fileOptions.hasOwnProperty(fileId)) {
                const options = fileOptions[fileId];
                const result = yield Logger_1.getPlatform(platform).cloneFile(salesforceUrl, fileId, options.fileName, options.folderName);
                Logger_1.logSuccessResponse(result, `[${platform}.CLONE_FILE]`);
                response[fileId] = result;
            }
        }
        catch (err) {
            Logger_1.logErrorResponse(err, `[${platform}.CLONE_FILE]`);
            errorResults.push(fileId);
        }
    }
    if (errorResults.length > 0) {
        res.status(400).send(errorResults);
    }
    else {
        res.status(200).send(response);
    }
}));
router.post('/download', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, fileId;
    ({ platform, salesforceUrl, fileId } = res.locals);
    try {
        const downloadLink = yield Logger_1.getPlatform(platform).downloadFile(salesforceUrl, fileId);
        Logger_1.logSuccessResponse(`downloadLink: ${downloadLink}`, `[${platform}.DOWNLOAD_FILE]`);
        res.status(200).send({ downloadLink });
    }
    catch (err) {
        Logger_1.logErrorResponse(err, `[${platform}.DOWNLOAD_FILE]`);
        res.status(406).send({ message: err.message });
    }
}));
router.post('/delete', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, fileId;
    ({ platform, salesforceUrl, fileId } = res.locals);
    try {
        const result = yield Logger_1.getPlatform(platform).deleteFile(salesforceUrl, fileId);
        Logger_1.logSuccessResponse(result, `[${platform}.DELETE_FILE]`);
        res.status(200).send(result);
    }
    catch (err) {
        Logger_1.logErrorResponse(err, `[${platform}.DELETE_FILE]`);
        const message = err.message || 'Unable to delete Cloud document';
        res.status(406).send({ message: message.replace('access', 'delete') });
    }
}));
router.post('/update', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, fileOptions;
    ({ platform, salesforceUrl, fileOptions } = res.locals);
    const logMessage = `[${platform}.FILES_UPDATE]`;
    const errorResults = [];
    for (const fileId in fileOptions) {
        try {
            if (fileOptions.hasOwnProperty(fileId)) {
                const options = fileOptions[fileId];
                const result = yield Logger_1.getPlatform(platform).updateFile(salesforceUrl, fileId, options);
                Logger_1.logSuccessResponse(result, logMessage);
            }
        }
        catch (error) {
            Logger_1.logErrorResponse(error, logMessage);
            errorResults.push(fileId);
        }
    }
    if (errorResults.length > 0) {
        res.status(400).send([`Could not update all files: ${errorResults.join(',')}`]);
    }
    else {
        res.status(200).send({});
    }
}));
router.post('/getCurrentUser', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl;
    ({ platform, salesforceUrl } = res.locals);
    try {
        const result = yield Logger_1.getPlatform(platform).getCurrentUser(salesforceUrl);
        Logger_1.logSuccessResponse(result, `[${platform}.GET_CURRENT_USER]`);
        res.status(200).send(result);
    }
    catch (err) {
        Logger_1.logErrorResponse(err, `[${platform}.GET_CURRENT_USER]`);
        res.status(400).send(`Failed to get current user: ${err}`);
    }
}));
exports.default = router;
