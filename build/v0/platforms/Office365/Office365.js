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
const axios_1 = __importDefault(require("axios"));
const xlsx_populate_1 = __importDefault(require("xlsx-populate"));
const Logger_1 = require("../../utils/Logger");
const InstanceManager_1 = __importDefault(require("../../utils/InstanceManager"));
const AuthProvider_1 = __importDefault(require("./AuthProvider"));
class Office365 {
    constructor() {
        this.delay = (ms) => {
            return new Promise((resolve) => {
                setTimeout(resolve, ms);
            });
        };
    }
    authorize(instanceKeyOrOrgUrl, clientId, clientSecret, tokens) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(tokens);
            try {
                let tenantId;
                ({ tenantId } = InstanceManager_1.default.get(instanceKeyOrOrgUrl, ["tenantId"]));
                const oAuth2Client = microsoft_graph_client_1.Client.initWithMiddleware({ authProvider: new AuthProvider_1.default(clientId, clientSecret, tenantId) });
                InstanceManager_1.default.upsert(instanceKeyOrOrgUrl, { oAuth2Client });
                Logger_1.logSuccessResponse({}, '[OFFICE365.AUTHORIZE]');
            }
            catch (err) {
                Logger_1.logErrorResponse(err, '[OFFICE365.AUTHORIZE]');
            }
        });
    }
    getFile(instanceKey, fileId) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKey, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKey, oAuth2Client);
            }
            return yield this.getDriveItem(oAuth2Client, groupId, fileId);
        });
    }
    testLock(instanceKeyOrOrgUrl, resourcesToTestLock) {
        return __awaiter(this, void 0, void 0, function* () {
            const retrievedFiles = yield this.getFilePromises(instanceKeyOrOrgUrl, resourcesToTestLock);
            const lockedResources = yield this.getLockedResources(instanceKeyOrOrgUrl, retrievedFiles);
            return yield this.shortlistUsersLockingResources(instanceKeyOrOrgUrl, lockedResources);
        });
    }
    createFile(instanceKeyOrOrgUrl, type, fileName, destinationFolderId) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKeyOrOrgUrl, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKeyOrOrgUrl, oAuth2Client);
            }
            const fileObject = yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/root:/${destinationFolderId}/${fileName}.${type}:/content`)
                .put(type == 'xlsx' ? yield this.createXlsxFileBuffer() : '');
            Object.assign(fileObject, {
                type: type
            });
            return this.constructDriveItem(fileObject);
        });
    }
    searchFile(instanceKeyOrOrgUrl, searchString) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKeyOrOrgUrl, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKeyOrOrgUrl, oAuth2Client);
            }
            const retFiles = [];
            const results = yield oAuth2Client
                .api(`/groups/${groupId}/drive/root/search(q='${searchString}')`)
                .get();
            const files = results.value || [];
            for (const file of files) {
                if (file.name === searchString) {
                    retFiles.push({
                        id: file.id,
                        name: file.name,
                        url: file.webUrl
                    });
                }
            }
            return retFiles;
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
        });
    }
    deleteFile(instanceKeyOrOrgUrl, docId) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKeyOrOrgUrl, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKeyOrOrgUrl, oAuth2Client);
            }
            yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/${docId}`)
                .delete();
            return {
                'id': docId
            };
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
            if ('parentReference' in fileOptions) {
                yield this.retrieveParentFolderId(oAuth2Client, groupId, fileOptions);
            }
            const fileToUpdate = JSON.parse(JSON.stringify(fileOptions));
            const res = yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/${fileId}`)
                .update(fileToUpdate);
            return { id: res.id };
        });
    }
    permissionCreate(instanceKey, fileId, newPermission) {
        var _a;
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
            const res = yield Promise.all([
                oAuth2Client
                    .api(`/groups/${groupId}/drive/items/${fileId}/invite`)
                    .post(permission),
                oAuth2Client
                    .api(`/groups/${groupId}/drive/items/${fileId}`)
                    .get()
            ]);
            const permissionRes = (res[0].value || [])[0] || {};
            const user = permissionRes.grantedTo
                ? permissionRes.grantedTo.user
                : permissionRes.grantedToIdentities
                    ? (permissionRes.grantedToIdentities[0] || []).user
                    : {};
            if (!('email' in user)) {
                user.email = yield this.getUserEmail(oAuth2Client, user.id);
            }
            user.viewLink = (_a = res[1]) === null || _a === void 0 ? void 0 : _a.webUrl;
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
            return yield this.retrievePermissionsList(oAuth2Client, permissions);
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
            return yield this.retrievePermissionsList(oAuth2Client, permissions);
        });
    }
    permissionUpdate(instanceKey, fileId, permissionId, permissionRole) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKey, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKey, oAuth2Client);
            }
            const updatedPermission = {
                roles: [permissionRole]
            };
            const res = yield oAuth2Client
                .api(`/groups/${groupId}/drive/items/${fileId}/permissions/${permissionId}`)
                .update(updatedPermission);
            return res;
        });
    }
    initUpload(instanceKeyOrOrgUrl, fileDetailKey, { fileName, mimeType }) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(instanceKeyOrOrgUrl, fileDetailKey, { fileName, mimeType });
        });
    }
    uploadFile(instanceKeyOrOrgUrl, fileDetailKey, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(instanceKeyOrOrgUrl, fileDetailKey, payload);
        });
    }
    endUpload(instanceKeyOrOrgUrl, fileDetailKey) {
        return __awaiter(this, void 0, void 0, function* () {
            let fileDetails;
            ({ fileDetails } = InstanceManager_1.default.get(instanceKeyOrOrgUrl, ["fileDetails"]));
            return yield fileDetails[fileDetailKey].file;
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
                throw new Error('[Office365.getGroupId] Please ensure that there are no duplicate group names.');
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
            let progressMonitor = yield axios_1.default.get(url);
            while (progressMonitor.data.status.toLowerCase() != 'completed') {
                this.delay(1000);
                progressMonitor = yield axios_1.default.get(url);
            }
            return progressMonitor.data.resourceId;
        });
    }
    getUserEmail(oAuth2Client, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield oAuth2Client
                .api(`/users/${userId}`)
                .get();
            return user.userPrincipalName;
        });
    }
    constructDriveItem(fileObject) {
        return __awaiter(this, void 0, void 0, function* () {
            const viewLink = fileObject.webUrl;
            const fileName = fileObject.name;
            const type = fileObject.type || fileName.substring(fileName.lastIndexOf('.') + 1);
            return {
                id: fileObject.id,
                name: fileName,
                exportPDF: 'OFFICE365_PLACEHOLDER',
                type: type,
                url: viewLink
            };
        });
    }
    getFilePromises(instanceKeyOrOrgUrl, resourcesToTestLock) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileRetrievalPromises = [];
            resourcesToTestLock.forEach(resourceId => {
                fileRetrievalPromises.push(this.getFile(instanceKeyOrOrgUrl, resourceId));
            });
            return yield Promise.all(fileRetrievalPromises);
        });
    }
    getLockedResources(instanceKeyOrOrgUrl, retrievedFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!retrievedFiles || retrievedFiles.length == 0)
                return [];
            const lockedRecords = [];
            const fileUpdatePromises = this.nameChangeMutation(instanceKeyOrOrgUrl, retrievedFiles, false);
            (yield Promise.allSettled(fileUpdatePromises)).filter((res, index) => {
                if (res.status == 'rejected') {
                    lockedRecords.push(retrievedFiles[index].id);
                }
            });
            this.nameChangeMutation(instanceKeyOrOrgUrl, retrievedFiles, true);
            return lockedRecords;
        });
    }
    shortlistUsersLockingResources(instanceKeyOrOrgUrl, lockedResources) {
        return __awaiter(this, void 0, void 0, function* () {
            const resourcesLockedByUserEmails = {};
            if (!lockedResources || lockedResources.length == 0)
                return resourcesLockedByUserEmails;
            const permissionRetrievalPromises = [];
            lockedResources.forEach((resource) => __awaiter(this, void 0, void 0, function* () {
                permissionRetrievalPromises.push(this.permissionList(instanceKeyOrOrgUrl, resource));
            }));
            (yield Promise.all(permissionRetrievalPromises)).forEach((listOfUserPermissionsByFile, index) => {
                const resourceId = lockedResources[index];
                listOfUserPermissionsByFile.forEach((userPermission) => {
                    const { role, email } = userPermission;
                    if (role == 'write' && email) {
                        let userLockedFiles = resourcesLockedByUserEmails[email];
                        if (!userLockedFiles) {
                            userLockedFiles = [resourceId];
                        }
                        else {
                            userLockedFiles.push(resourceId);
                        }
                        resourcesLockedByUserEmails[email] = userLockedFiles;
                    }
                });
            });
            return resourcesLockedByUserEmails;
        });
    }
    nameChangeMutation(instanceKeyOrOrgUrl, retrievedFiles, isReset) {
        const NAME_LOCK_MUTATION = 'LOCKCHECK__';
        const fileUpdatePromises = [];
        retrievedFiles.forEach(file => {
            const originalName = file.name;
            const fileId = file.id;
            const fileOptions = {
                id: fileId,
                name: isReset ?
                    originalName :
                    NAME_LOCK_MUTATION + originalName
            };
            fileUpdatePromises.push(this.updateFile(instanceKeyOrOrgUrl, fileId, fileOptions));
        });
        return fileUpdatePromises;
    }
    createXlsxFileBuffer() {
        return __awaiter(this, void 0, void 0, function* () {
            const workBook = yield xlsx_populate_1.default.fromBlankAsync();
            return yield workBook.outputAsync();
        });
    }
    retrieveParentFolderId(oAuth2Client, groupId, fileOptions) {
        return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
            const parentReference = fileOptions.parentReference;
            const { folderId } = yield this.getFolderAndDriveId(oAuth2Client, groupId, parentReference.id);
            parentReference.id = folderId;
            resolve();
        }));
    }
    retrievePermissionsList(oAuth2Client, permissions) {
        return __awaiter(this, void 0, void 0, function* () {
            const permissionList = [{}];
            for (const permission of permissions) {
                const permissionId = permission.id;
                const roles = permission['roles'] || [];
                if ('grantedTo' in permission ||
                    'grantedToIdentitiesV2' in permission ||
                    'grantedToIdentities' in permission) {
                    for (const role of roles) {
                        if (role === 'owner') {
                            continue;
                        }
                        const userPermissions = permission['grantedToIdentitiesV2'] ||
                            permission['grantedToIdentities'] ||
                            [permission['grantedTo']] ||
                            [];
                        userPermissions.forEach(({ user }) => __awaiter(this, void 0, void 0, function* () {
                            if (user) {
                                if (!('email' in user)) {
                                    try {
                                        if (user.id)
                                            user.email = yield this.getUserEmail(oAuth2Client, user.id);
                                    }
                                    catch (error) {
                                        Logger_1.logErrorResponse(error, '[OFFICE365_RETRIEVE_PERMISSIONS_LIST');
                                    }
                                }
                                permissionList.push({
                                    id: permissionId,
                                    email: user.email,
                                    role: role
                                });
                            }
                        }));
                    }
                }
            }
            return permissionList;
        });
    }
    getCurrentUser(instanceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            let oAuth2Client, groupId;
            ({ oAuth2Client, groupId } = InstanceManager_1.default.get(instanceKey, ["oAuth2Client", "groupId"]));
            if (groupId == undefined) {
                groupId = yield this.getGroupId(instanceKey, oAuth2Client);
            }
            return yield oAuth2Client
                .api(`/me`)
                .get();
        });
    }
}
exports.default = new Office365();
