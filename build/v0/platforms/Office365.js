'use strict';
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
require("isomorphic-fetch");
const microsoft_graph_client_1 = require("@microsoft/microsoft-graph-client");
const xlsx_populate_1 = __importDefault(require("xlsx-populate"));
const axios = require('axios');
const qs_1 = __importDefault(require("qs"));
const node_url_shortener_1 = __importDefault(require("node-url-shortener"));
const Logger_1 = require("../utils/Logger");
const InstanceManager_1 = __importDefault(require("../utils/InstanceManager"));
class Office365 {
    constructor() {
        this.scope = 'https://graph.microsoft.com/.default offline_access';
        this.promisifiedShorten = (url) => {
            return new Promise((resolve, reject) => {
                node_url_shortener_1.default.short(url, function (err, res) {
                    if (err)
                        return reject(`Error from URL shortening: ${err}`);
                    resolve(res);
                });
            });
        };
        this.delay = (ms) => {
            return new Promise((resolve) => {
                setTimeout(resolve, ms);
            });
        };
    }
    generateTokenEndpoint(tenantId) {
        return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    }
    authorize(instanceKeyOrOrgUrl, clientId, clientSecret, tokens) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(tokens);
            try {
                const postData = {
                    client_id: clientId,
                    scope: this.scope,
                    client_secret: clientSecret,
                    grant_type: 'client_credentials'
                };
                let tenantId;
                ({ tenantId } = InstanceManager_1.default.get(instanceKeyOrOrgUrl, ["tenantId"]));
                const options = {
                    method: 'POST',
                    headers: { 'content-type': 'application/x-www-form-urlencoded' },
                    data: qs_1.default.stringify(postData),
                    url: this.generateTokenEndpoint(tenantId)
                };
                const tokenRequestResponse = yield axios(options);
                const token = tokenRequestResponse.data.access_token;
                const oAuth2Client = microsoft_graph_client_1.Client.init({
                    authProvider: (done) => {
                        done(null, token);
                    }
                });
                InstanceManager_1.default.upsert(instanceKeyOrOrgUrl, { oAuth2Client });
                Logger_1.logSuccessResponse({}, '[OFFICE365.AUTHORIZE]');
            }
            catch (err) {
                Logger_1.logErrorResponse(err, '[OFFICE365.AUTHORIZE]');
            }
        });
    }
    createFile(instanceKeyOrOrgUrl, type, fileName) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, destinationFolderId, groupId;
            ({ oAuth2Client, destinationFolderId, groupId } = InstanceManager_1.default.get(instanceKeyOrOrgUrl, ["oAuth2Client", "destinationFolderId", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKeyOrOrgUrl, oAuth2Client);
            }
            const fileObject = yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/root:/${destinationFolderId}/${fileName}.${type}:/content`)
                .put(type == 'xlsx' ? yield this.createXlsxFileBuffer() : '');
            return this.constructDriveItem(fileObject);
        });
    }
    cloneFile(instanceKeyOrOrgUrl, fileId, fileName, folderName) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId, folderId, driveId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKeyOrOrgUrl, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKeyOrOrgUrl, oAuth2Client);
            }
            ({ folderId, driveId } = yield this.getFolderAndDriveId(oAuth2Client, groupId, folderName));
            const monitorResponse = yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/${fileId}/copy`)
                .responseType(microsoft_graph_client_1.ResponseType.RAW)
                .post({
                "parentReference": {
                    "driveId": driveId,
                    "id": folderId
                },
                "name": fileName
            });
            const itemId = yield this.getItemIdFromMonitorURL(monitorResponse.headers.get("location"));
            return this.getDriveItem(oAuth2Client, groupId, itemId);
        });
    }
    supersedeFile(instanceKeyOrOrgUrl, fileType, fileName, docId) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKeyOrOrgUrl, ["oAuth2Client", "groupId"]));
            try {
                if (groupId == undefined) {
                    groupId = yield this.getGroupId(instanceKeyOrOrgUrl, oAuth2Client);
                }
                const nameWithoutExtension = fileName.split(`.${fileType}`)[0];
                const driveItem = {
                    name: nameWithoutExtension + "_Superseded." + fileType
                };
                const fileObject = yield oAuth2Client
                    .api(`/groups/${groupId}/drive/items/${docId}`)
                    .update(driveItem);
                return fileObject.id;
            }
            catch (err) {
                return err.message;
            }
        });
    }
    downloadFile(instanceKeyOrOrgUrl, fileId) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKeyOrOrgUrl, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKeyOrOrgUrl, oAuth2Client);
            }
            const fileObject = yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/${fileId}/content?format=pdf`)
                .responseType(microsoft_graph_client_1.ResponseType.RAW)
                .get();
            if (fileObject.status >= 400) {
                throw {
                    code: fileObject.status,
                    message: 'File cannot be converted to PDF and downloaded. It might be created from Propel and has not yet been edited (still empty).'
                };
            }
            return fileObject.url;
        });
    }
    updateFile(instanceKey, fileId, fileOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKey, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKey, oAuth2Client);
            }
            const res = yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/${fileId}`)
                .update(fileOptions);
            return { id: res.id };
        });
    }
    permissionCreate(instanceKey, fileId, newPermission) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKey, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKey, oAuth2Client);
            }
            const permission = {
                requireSignIn: true,
                sendInvitation: false,
                roles: [newPermission.role],
                recipients: [
                    { email: newPermission.email }
                ]
            };
            const res = yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/${fileId}/invite`)
                .post(permission);
            const fullRes = (res.value || [])[0] || {};
            const user = fullRes.grantedTo
                ? fullRes.grantedTo.user
                : fullRes.grantedToIdentities
                    ? (fullRes.grantedToIdentities[0] || []).user
                    : {};
            return user.email === newPermission.email
                ? user
                : {};
        });
    }
    permissionGet(instanceKey, fileId, permissionId) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKey, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKey, oAuth2Client);
            }
            const res = yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/${fileId}/permissions/${permissionId}`)
                .get();
            const permissions = res.value || [];
            return this.retrievePermissionsList(permissions);
        });
    }
    permissionDelete(instanceKey, fileId, permissionId) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKey, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKey, oAuth2Client);
            }
            yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/${fileId}/permissions/${permissionId}`)
                .delete();
        });
    }
    permissionList(instanceKey, fileId) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKey, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKey, oAuth2Client);
            }
            const res = yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/${fileId}/permissions`)
                .get();
            const permissions = res.value || [];
            return this.retrievePermissionsList(permissions);
        });
    }
    initUpload(instanceKeyOrOrgUrl, { fileName, mimeType, fileSize }) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(instanceKeyOrOrgUrl, { fileName, mimeType, fileSize });
        });
    }
    uploadFile(instanceKeyOrOrgUrl, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(instanceKeyOrOrgUrl, payload);
        });
    }
    endUpload(instanceKeyOrOrgUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            let file;
            ({ file } = InstanceManager_1.default.get(instanceKeyOrOrgUrl, ["file"]));
            return yield file;
        });
    }
    getDriveItem(oAuth2Client, groupId, driveItemId) {
        return __awaiter(this, void 0, void 0, function* () {
            const driveItem = yield oAuth2Client.api(`/groups/${groupId}/drive/items/${driveItemId}`).get();
            return this.constructDriveItem(driveItem);
        });
    }
    getGroupId(instanceKeyOrOrgUrl, oAuth2Client) {
        return __awaiter(this, void 0, void 0, function* () {
            const getGroups = yield oAuth2Client.api('groups').get();
            const group = getGroups.value.filter((group) => group.displayName === 'PropelPLM');
            if (group.length > 1) {
                throw new Error('[Office365.getGroupId] Please there are no duplicate group names.');
            }
            const groupId = group[0].id;
            InstanceManager_1.default.upsert(instanceKeyOrOrgUrl, { groupId });
            return groupId;
        });
    }
    getFolderAndDriveId(oAuth2Client, groupId, folderName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const folderQueryResult = yield oAuth2Client.api(`/groups/${groupId}/drive/root:/${folderName}`).get();
                return {
                    folderId: folderQueryResult.id,
                    driveId: folderQueryResult.parentReference.driveId
                };
            }
            catch (err) {
                throw new Error(`[Office365.getFolderAndDriveId]: ${err}`);
            }
        });
    }
    getItemIdFromMonitorURL(url) {
        return __awaiter(this, void 0, void 0, function* () {
            let progressMonitor = yield axios.get(url);
            while (progressMonitor.data.status.toLowerCase() != 'completed') {
                this.delay(1000);
                progressMonitor = yield axios.get(url);
            }
            return progressMonitor.data.resourceId;
        });
    }
    constructDriveItem(fileObject) {
        return __awaiter(this, void 0, void 0, function* () {
            const viewLink = yield this.promisifiedShorten(fileObject.webUrl);
            return {
                id: fileObject.id,
                name: fileObject.name,
                viewLink
            };
        });
    }
    createXlsxFileBuffer() {
        return __awaiter(this, void 0, void 0, function* () {
            const workBook = yield xlsx_populate_1.default.fromBlankAsync();
            return yield workBook.outputAsync();
        });
    }
    retrievePermissionsList(permissions) {
        const permissionList = [{}];
        for (const permission of permissions) {
            const permissionId = permission.id;
            const roles = permission['roles'] || [];
            if (permission.hasOwnProperty('grantedToIdentities')) {
                const users = permission['grantedToIdentities'] || [];
                for (const user of users) {
                    for (const role of roles) {
                        permissionList.push({
                            id: permissionId,
                            email: user.email,
                            role: role
                        });
                    }
                }
            }
            else if (permission.hasOwnProperty('grantedTo')) {
                for (const role of roles) {
                    const user = permission['grantedTo'];
                    permissionList.push({
                        id: permissionId,
                        email: user.email,
                        role: role
                    });
                }
            }
        }
        return permissionList;
    }
}
exports.default = new Office365();
