'use strict';

import 'isomorphic-fetch';
import { Client, ResponseType } from '@microsoft/microsoft-graph-client';
import axios from 'axios';
import XlsxPopulate from 'xlsx-populate';

import { logSuccessResponse, logErrorResponse } from '../../utils/Logger';
import InstanceManager from '../../utils/InstanceManager';
import AuthProvider from './AuthProvider';
import {
    CreatedFileDetails,
    DADownloadDetails,
    DownloadParams,
    StoragePlatform
} from '../StoragePlatform';
import { PassThrough } from 'stream';

export class Office365 implements StoragePlatform {
    private constructor() {}
    private oAuth2Client: CloudStorageProviderClient;
    // private static className: string = 'office365';

    static async authorize(instanceKey: string): Promise<StoragePlatform> {
        try {
            const officeInstance = new Office365();
            let clientId: string, clientSecret: string, tenantId: string;
            ({ clientId, clientSecret, tenantId } = await InstanceManager.get(
                instanceKey,
                [MapKey.clientId, MapKey.clientSecret, MapKey.tenantId]
            ));
            // client should handle refreshing of access token
            officeInstance.oAuth2Client = Client.initWithMiddleware({
                authProvider: new AuthProvider(clientId, clientSecret, tenantId)
            });
            logSuccessResponse(instanceKey, '[OFFICE365.AUTHORIZE]');
            return officeInstance;
        } catch (err) {
            logErrorResponse(err, '[OFFICE365.AUTHORIZE]');
            throw err;
        }
    }

    public async getFile(
        instanceKey: string,
        fileId: string
    ): Promise<Record<string, string>> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKey, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKey);
        }

        return await this.getDriveItem(groupId, fileId);
    }

    public async testLock(
        instanceKeyOrOrgUrl: string,
        resourcesToTestLock: string[]
    ): Promise<Record<string, any>> {
        const retrievedFiles: Record<string, string>[] =
            await this.getFilePromises(
                instanceKeyOrOrgUrl,
                resourcesToTestLock
            );
        const lockedResources: string[] = await this.getLockedResources(
            instanceKeyOrOrgUrl,
            retrievedFiles
        );
        return await this.shortlistUsersLockingResources(
            instanceKeyOrOrgUrl,
            lockedResources
        );
    }

    public async createFile(
        instanceKeyOrOrgUrl: string,
        type: string,
        fileName: string,
        destinationFolderId: string
    ): Promise<Record<string, string>> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKeyOrOrgUrl, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKeyOrOrgUrl);
        }

        const fileObject: Record<string, string> = await this.oAuth2Client
            .api(
                `/groups/${groupId}/drive/items/root:/${destinationFolderId}/${fileName}.${type}:/content`
            )
            .put(type == 'xlsx' ? await this.createXlsxFileBuffer() : '');

        Object.assign(fileObject, {
            type: type
        });
        return this.constructDriveItem(fileObject);
    }

    public async searchFile(
        instanceKeyOrOrgUrl: string,
        searchString: string
    ): Promise<Record<string, string>[]> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKeyOrOrgUrl, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKeyOrOrgUrl);
        }

        const retFiles: Record<string, string>[] = [];
        const results: Record<string, any> = await this.oAuth2Client
            .api(`/groups/${groupId}/drive/root/search(q='${searchString}')`)
            .get();

        /** Filter out results which do not match the file name exactly */
        const files: Record<string, any>[] = results.value || [];
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
    }

    public async cloneFile(
        instanceKeyOrOrgUrl: string,
        fileId: string,
        fileName: string,
        folderName: string
    ): Promise<Record<string, string>> {
        let groupId: string, folderId: string, driveId: string;
        ({ groupId } = await InstanceManager.get(instanceKeyOrOrgUrl, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKeyOrOrgUrl);
        }
        ({ folderId, driveId } = await this.getFolderAndDriveId(
            groupId,
            folderName
        ));

        const monitorResponse: Record<string, any> = await this.oAuth2Client
            .api(`/groups/${groupId}/drive/items/${fileId}/copy`)
            .responseType(ResponseType.RAW)
            .post({
                parentReference: {
                    driveId: driveId,
                    id: folderId
                },
                name: fileName
            });
        const itemId = await this.getItemIdFromMonitorURL(
            monitorResponse.headers.get('location')
        );
        return this.getDriveItem(groupId, itemId);
    }

    public async supersedeFile(
        instanceKeyOrOrgUrl: string,
        fileType: string,
        fileName: string,
        docId: string
    ): Promise<string> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKeyOrOrgUrl, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKeyOrOrgUrl);
        }

        const nameWithoutExtension: string = fileName.split(`.${fileType}`)[0];
        const driveItem = {
            name: nameWithoutExtension + '_Superseded.' + fileType
        };

        const fileObject: Record<string, string> = await this.oAuth2Client
            .api(`/groups/${groupId}/drive/items/${docId}`)
            .update(driveItem);

        return fileObject.id;
    }

    public async deleteFile(
        instanceKeyOrOrgUrl: string,
        docId: string
    ): Promise<Record<string, string>> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKeyOrOrgUrl, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKeyOrOrgUrl);
        }

        await this.oAuth2Client
            .api(`/groups/${groupId}/drive/items/${docId}`)
            .delete(); // returns undefined object

        return {
            id: docId
        };
    }

    public async downloadFile(
        options: Partial<DownloadParams>
    ): Promise<string> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(
            options.instanceKeyOrOrgUrlOrOrgId!,
            [MapKey.groupId]
        ));

        if (groupId == undefined) {
            groupId = await this.getGroupId(
                options.instanceKeyOrOrgUrlOrOrgId!
            );
        }

        const daDownloadDetailsList: Array<DADownloadDetails> = options.daDownloadDetailsList!!;
        if (daDownloadDetailsList.length === 1) {
            const fileObject: Record<string, any> = await this.oAuth2Client
                .api(
                    // `/groups/${groupId}/drive/items/${options?.daDownloadDetailsList?.[0]?.fileId}/content?format=pdf`
                    `/groups/${groupId}/drive/items/${options?.daDownloadDetailsList?.[0]?.fileId}?$select=content.downloadUrl`
                )
                .get();

            if (fileObject.status >= 400) {
                throw {
                    code: fileObject.status,
                    message:
                        'File cannot be converted to PDF and downloaded. It might be created from Propel and has not yet been edited (still empty).'
                };
            }

            return fileObject['@microsoft.graph.downloadUrl'];
        } else {
            throw {
                code: 500,
                message:
                    'Not yet implemented.'
            };
        }
    }

    async updateFile(
        instanceKey: string,
        fileId: string,
        fileOptions: Record<string, any>
    ): Promise<Record<string, string>> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKey, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKey);
        }

        /** Convert parent folder name into an id, if moving file to another folder */
        if ('parentReference' in fileOptions) {
            await this.retrieveParentFolderId(groupId, fileOptions);
        }

        /** Need deep copy to provide to api */
        const fileToUpdate = JSON.parse(JSON.stringify(fileOptions));

        /** Send request to update file */
        const res: Record<string, any> = await this.oAuth2Client
            .api(`/groups/${groupId}/drive/items/${fileId}`)
            .update(fileToUpdate);

        return { id: res.id };
    }

    /**
     * Permission methods
     */

    async permissionCreate(
        instanceKey: string,
        fileId: string,
        newPermission: Record<string, string>
    ): Promise<Record<string, string>> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKey, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKey);
        }

        /** Construct new permission to create */
        const permission: Record<string, any> = {
            requireSignIn: true,
            sendInvitation: false,
            roles: [newPermission.role],
            recipients: [{ email: newPermission.email }]
        };

        /** Send request to create permission */
        const res: Record<string, any> = await Promise.all([
            this.oAuth2Client
                .api(`/groups/${groupId}/drive/items/${fileId}/invite`)
                .post(permission),
            this.oAuth2Client
                .api(`/groups/${groupId}/drive/items/${fileId}`)
                .get()
        ]);

        /** Return user specific to newly created permission */
        const permissionRes = (res[0].value || [])[0] || {};
        const user = permissionRes.grantedTo
            ? permissionRes.grantedTo.user
            : permissionRes.grantedToIdentities
            ? (permissionRes.grantedToIdentities[0] || []).user
            : {};

        /** Get user email addres if creating permission for internal user */
        if (!('email' in user)) {
            user.email = await this.getUserEmail(user.id);
        }

        user.viewLink = res[1]?.webUrl;
        return user.email === newPermission.email ? user : {};
    }

    /**
     * permissionGet
     * @description Retrieve specific permission which might have been granted to many identities
     * @param instanceKey {string}
     * @param fileId {string} external file id
     * @param permissionId {string} file permission id
     */
    async permissionGet(
        instanceKey: string,
        fileId: string,
        permissionId: string
    ): Promise<Record<string, string>[]> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKey, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKey);
        }

        const res: Record<string, any> = await this.oAuth2Client
            .api(
                `/groups/${groupId}/drive/items/${fileId}/permissions/${permissionId}`
            )
            .get();
        const permissions = res.value || [];
        return await this.retrievePermissionsList(permissions);
    }

    /**
     * permissionDelete
     * @param instanceKey {string}
     * @param fileId {string} external file id
     * @param permissionId {string} permission to delete
     */
    async permissionDelete(
        instanceKey: string,
        fileId: string,
        permissionId: string
    ): Promise<void> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKey, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKey);
        }

        /** Send request to delete permission */
        await this.oAuth2Client
            .api(
                `/groups/${groupId}/drive/items/${fileId}/permissions/${permissionId}`
            )
            .delete();
    }

    /**
     * permissionList
     * @description Retrieves list of all permissions for specific file
     * @param instanceKey {string}
     * @param fileId {string} external file id
     */
    async permissionList(
        instanceKey: string,
        fileId: string
    ): Promise<Record<string, string>[]> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKey, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKey);
        }

        /** Send request to retrieve list of permissions */
        const res: Record<string, any> = await this.oAuth2Client
            .api(`/groups/${groupId}/drive/items/${fileId}/permissions`)
            .get();

        const permissions = res.value || [];
        return await this.retrievePermissionsList(permissions);
    }

    /**
     * permissionUpdate
     *
     *  CASE: NON-GUEST USERS
     *  The permission model for sharepoint is a little bit different, it seems one permission id with a
     *  specified role can be granted to many individuals. And the grantedToIdentities property is read-
     *  only and cannot be modified during an update call. So for any given permission, in order to update
     *  only the users that are required, we need to retrieve all granted identities, delete the entire permission
     *  and insert all the permissions again, modifying the role to one permission provided we care about.
     *  FLOW:
     *    1) list permission
     *    2) delete permission
     *    3) insert new permission for specified user with new role
     *    4) insert all other permissions with same role
     *
     *  CURRENTLY: GUEST USERS
     *  Simple update of permission roles for each file and permission ids given.
     */
    async permissionUpdate(
        instanceKey: string,
        fileId: string,
        permissionId: string,
        permissionRole: string
    ): Promise<Record<string, string>> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKey, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKey);
        }

        const updatedPermission = {
            roles: [permissionRole]
        };

        const res: Record<string, any> = await this.oAuth2Client
            .api(
                `/groups/${groupId}/drive/items/${fileId}/permissions/${permissionId}`
            )
            .update(updatedPermission);

        return res; // returns a permission object
    }

    // TODO: below methods' "implementation" are placeholders to prevent tsc errors
    async initUpload(
        instanceKey: string,
        uploadStream: PassThrough,
        fileDetailsMap: Record<string, FileDetail>,
        fileDetailKey: string
    ): Promise<any> {
        console.log(instanceKey, uploadStream, fileDetailsMap, fileDetailKey);
    }

    async uploadFile(
        fileDetailsMap: Record<string, FileDetail>,
        fileDetailKey: string,
        payload: Record<string, any>
    ): Promise<void> {
        console.log(fileDetailsMap, fileDetailKey, payload);
    }

    async endUpload(
        fileDetailsMap: Record<string, FileDetail>,
        fileDetailKey: string
    ): Promise<CreatedFileDetails> {
        const fileDetails = fileDetailsMap[fileDetailKey];
        return await fileDetails.file;
    }

    // helper SDK calls
    // returns driveItem object by calling sdk with driveItem Id
    async getDriveItem(
        groupId: string,
        driveItemId: string
    ): Promise<Record<string, string>> {
        const driveItem = await this.oAuth2Client
            .api(`/groups/${groupId}/drive/items/${driveItemId}`)
            .get();
        return this.constructDriveItem(driveItem);
    }

    async getGroupId(instanceKeyOrOrgUrl: string): Promise<string> {
        const getGroups = await this.oAuth2Client.api('groups').get();
        const group = getGroups.value.filter(
            (group: Record<string, any>) => group.displayName === 'PropelPLM'
        );
        if (group.length > 1) {
            throw new Error(
                '[Office365.getGroupId] Please ensure that there are no duplicate group names.'
            );
        }
        const groupId = group[0].id;
        InstanceManager.upsert(instanceKeyOrOrgUrl, { groupId });
        return groupId;
    }

    // returns folder and driveId by calling sdk with folderName
    async getFolderAndDriveId(
        groupId: string,
        folderName: string
    ): Promise<Record<string, string>> {
        try {
            const folderQueryResult: Record<string, any> =
                await this.oAuth2Client
                    .api(`/groups/${groupId}/drive/root:/${folderName}`)
                    .get();
            return {
                folderId: folderQueryResult.id,
                driveId: folderQueryResult.parentReference.driveId
            };
        } catch (err) {
            throw new Error(`[Office365.getFolderAndDriveId]: ${err}`);
        }
    }

    // repeatedly GETs monitor URL and return the resourceId only when it is completed
    async getItemIdFromMonitorURL(url: string): Promise<string> {
        let progressMonitor = await axios.get(url);
        while (progressMonitor.data.status.toLowerCase() != 'completed') {
            this.delay(1000); //wait for 1s
            progressMonitor = await axios.get(url);
        }
        // return id of drive item, ready for use
        return progressMonitor.data.resourceId;
    }

    /**
     * getUserEmail
     * @param oAuth2Client {OAuth2Client} Client to interface API
     * @param userId {string} User Id to retrieve email for, should be internal user
     * @returns Email address of user
     */
    async getUserEmail(userId: string): Promise<string> {
        const user = await this.oAuth2Client.api(`/users/${userId}`).get();

        return user.userPrincipalName;
    }

    /** Private Helper Methods */
    private async constructDriveItem(fileObject: Record<string, string>) {
        const viewLink: string = fileObject.webUrl;
        const fileName = fileObject.name;
        const type =
            fileObject.type ||
            fileName.substring(fileName.lastIndexOf('.') + 1);
        return {
            id: fileObject.id,
            name: fileName,
            exportPDF: 'OFFICE365_PLACEHOLDER',
            type: type,
            url: viewLink
        };
    }

    private async getFilePromises(
        instanceKeyOrOrgUrl: string,
        resourcesToTestLock: string[]
    ): Promise<Record<string, string>[]> {
        const fileRetrievalPromises: Promise<Record<string, string>>[] = [];
        resourcesToTestLock.forEach((resourceId) => {
            fileRetrievalPromises.push(
                this.getFile(instanceKeyOrOrgUrl, resourceId)
            );
        });
        return await Promise.all(fileRetrievalPromises);
    }

    private async getLockedResources(
        instanceKeyOrOrgUrl: string,
        retrievedFiles: Record<string, string>[]
    ): Promise<string[]> {
        if (!retrievedFiles || retrievedFiles.length == 0) return [];
        const lockedRecords: string[] = [];
        const fileUpdatePromises: Promise<Record<string, string>>[] =
            this.nameChangeMutation(instanceKeyOrOrgUrl, retrievedFiles, false);
        (await Promise.allSettled(fileUpdatePromises)).filter(
            (
                res: PromiseSettledResult<Record<string, string>>,
                index: number
            ) => {
                if (res.status == 'rejected') {
                    lockedRecords.push(retrievedFiles[index].id);
                }
            }
        );
        this.nameChangeMutation(instanceKeyOrOrgUrl, retrievedFiles, true);
        return lockedRecords;
    }

    private async shortlistUsersLockingResources(
        instanceKeyOrOrgUrl: string,
        lockedResources: string[]
    ): Promise<Record<string, any>> {
        const resourcesLockedByUserEmails: Record<string, string[]> = {};
        if (!lockedResources || lockedResources.length == 0)
            return resourcesLockedByUserEmails;
        const permissionRetrievalPromises: Promise<Record<string, string>[]>[] =
            [];
        lockedResources.forEach(async (resource) => {
            permissionRetrievalPromises.push(
                this.permissionList(instanceKeyOrOrgUrl, resource)
            );
        });
        (await Promise.all(permissionRetrievalPromises)).forEach(
            (listOfUserPermissionsByFile: any, index: number) => {
                const resourceId = lockedResources[
                    index
                ] as keyof typeof resourcesLockedByUserEmails;
                listOfUserPermissionsByFile.forEach(
                    (userPermission: Record<string, string>) => {
                        const { role, email } = userPermission;
                        if (role == 'write' && email) {
                            let userLockedFiles: string[] =
                                resourcesLockedByUserEmails[email];
                            if (!userLockedFiles) {
                                userLockedFiles = [resourceId];
                            } else {
                                userLockedFiles.push(resourceId);
                            }
                            resourcesLockedByUserEmails[email] =
                                userLockedFiles;
                        }
                    }
                );
            }
        );
        return resourcesLockedByUserEmails;
    }

    nameChangeMutation(
        instanceKeyOrOrgUrl: string,
        retrievedFiles: Record<string, string>[],
        isReset: Boolean
    ): Promise<Record<string, string>>[] {
        const NAME_LOCK_MUTATION = 'LOCKCHECK__';
        const fileUpdatePromises: Promise<Record<string, string>>[] = [];
        retrievedFiles.forEach((file) => {
            const originalName: string = file.name;
            const fileId = file.id;
            const fileOptions: Record<string, string> = {
                id: fileId,
                name: isReset ? originalName : NAME_LOCK_MUTATION + originalName
            };
            fileUpdatePromises.push(
                this.updateFile(instanceKeyOrOrgUrl, fileId, fileOptions)
            );
        });
        return fileUpdatePromises;
    }

    private async createXlsxFileBuffer() {
        const workBook = await XlsxPopulate.fromBlankAsync();
        return await workBook.outputAsync();
    }

    private delay = (ms: number): Promise<void> => {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    };

    /**
     * retrieveParentFolderId
     * @description Method converts folder name into folder id for updating file metadata
     * @param oAuth2Client {OAuth2Client} Client to interface API
     * @param groupId: {string} String containing group Id
     * @param fileOptions: {<string, any>} Map of file options for updating
     */
    private retrieveParentFolderId(
        groupId: string,
        fileOptions: Record<string, any>
    ): Promise<void> {
        return new Promise(async (resolve) => {
            const parentReference: Record<string, string> =
                fileOptions.parentReference;
            /** Fetch folder Id for provided folder name */
            const { folderId } = await this.getFolderAndDriveId(
                groupId,
                parentReference.id
            );
            parentReference.id = folderId;
            resolve();
        });
    }

    /**
     * retrievePermissionsList
     * @description Parses through list of permissions and pulls out id, email and role for each
     * @param oAuth2Client {OAuth2Client} Client to interface API
     * @param permissions {<string, any>[]}
     * @return List of permissions
     */
    private async retrievePermissionsList(
        permissions: Record<string, any>[]
    ): Promise<Record<string, string>[]> {
        const permissionList: Record<string, string>[] = [{}];

        /** Iterate through all the listed permissions */
        for (const permission of permissions) {
            const permissionId = permission.id;
            /** Continue only if permission has been granted to an individual */
            const roles: string[] = permission['roles'] || [];
            if (
                'grantedTo' in permission ||
                'grantedToIdentitiesV2' in permission ||
                'grantedToIdentities' in permission
            ) {
                for (const role of roles) {
                    /** Skip owner permissions */
                    if (role === 'owner') {
                        continue;
                    }
                    const userPermissions: Record<string, any>[] =
                        permission['grantedToIdentitiesV2'] ||
                        permission['grantedToIdentities'] || [
                            permission['grantedTo']
                        ] ||
                        [];

                    userPermissions.forEach(async ({ user }) => {
                        if (user) {
                            /** Get user email address if creating permission for internal user */
                            if (!('email' in user)) {
                                try {
                                    if (user.id)
                                        user.email = await this.getUserEmail(
                                            user.id
                                        );
                                } catch (error) {
                                    logErrorResponse(
                                        error,
                                        '[OFFICE365_RETRIEVE_PERMISSIONS_LIST'
                                    );
                                }
                            }
                            permissionList.push({
                                id: permissionId,
                                email: user.email,
                                role: role
                            });
                        }
                    });
                }
            }
        }
        return permissionList;
    }

    public async getCurrentUser(
        instanceKey: string
    ): Promise<Record<string, string>> {
        let groupId: string;
        ({ groupId } = await InstanceManager.get(instanceKey, [
            MapKey.groupId
        ]));

        if (groupId == undefined) {
            groupId = await this.getGroupId(instanceKey);
        }

        return await this.oAuth2Client.api(`/me`).get();
    }
}
