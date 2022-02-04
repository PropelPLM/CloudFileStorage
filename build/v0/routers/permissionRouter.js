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
router.post('/create', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, fileId, email, role, type;
    ({ platform, salesforceUrl, fileId, email, role, type } = res.locals);
    const logMessage = `[${platform}.PERMISSION_CREATE]`;
    const permission = {
        fileId: fileId,
        email: email,
        role: role,
        type: type
    };
    try {
        const permissionId = yield Logger_1.getPlatform(platform).permissionCreate(salesforceUrl, fileId, permission);
        Logger_1.logSuccessResponse(permissionId, logMessage);
        res.status(200).send(permissionId);
    }
    catch (error) {
        Logger_1.logErrorResponse(error, logMessage);
        res.status(400).send(error);
    }
}));
router.post('/delete', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, fileId, permissionId;
    ({ platform, salesforceUrl, fileId, permissionId } = res.locals);
    const logMessage = `[${platform}.PERMISSION_DELETE]`;
    try {
        yield Logger_1.getPlatform(platform).permissionDelete(salesforceUrl, fileId, permissionId);
        Logger_1.logSuccessResponse(null, logMessage);
        res.status(200).send({});
    }
    catch (error) {
        Logger_1.logErrorResponse(error, logMessage);
        res.status(400).send(error);
    }
}));
router.post('/list', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, fileIds;
    ({ platform, salesforceUrl, fileIds } = res.locals);
    const logMessage = `[${platform}.PERMISSION_LIST]`;
    const filePermissionMap = {};
    const errorResults = [];
    for (const fileId of fileIds) {
        try {
            const permissionsList = yield Logger_1.getPlatform(platform).permissionList(salesforceUrl, fileId);
            filePermissionMap[fileId] = permissionsList;
            Logger_1.logSuccessResponse(permissionsList, logMessage);
        }
        catch (error) {
            Logger_1.logErrorResponse(error, logMessage);
            errorResults.push(fileId);
        }
    }
    if (errorResults.length > 0) {
        res.status(400).send([`Could not retrieve permissions for all files: ${errorResults.join(',')}`]);
    }
    else {
        res.status(200).send({ filePermissionMap });
    }
}));
router.post('/update', (_, res) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, permissionMap;
    ({ platform, salesforceUrl, permissionMap } = res.locals);
    const logMessage = `[${platform}.PERMISSION_UPDATE]`;
    const returnMap = {};
    const errorResults = [];
    const contentIds = Object.keys(permissionMap);
    for (const contentId of contentIds) {
        try {
            const fileId = contentId.split(":")[0];
            const newPermission = permissionMap[contentId];
            const permissionsUpdate = yield Logger_1.getPlatform(platform).permissionUpdate(salesforceUrl, fileId, newPermission.permId, newPermission.role);
            returnMap[contentId] = permissionsUpdate;
            Logger_1.logSuccessResponse(permissionsUpdate, logMessage);
        }
        catch (error) {
            Logger_1.logErrorResponse(error, logMessage);
            errorResults.push(contentId);
        }
    }
    if (errorResults.length > 0) {
        res.status(400).send([`Could not update permissions for all files: ${errorResults.join(',')}`]);
    }
    else {
        res.status(200).send({ returnMap });
    }
}));
exports.default = router;
