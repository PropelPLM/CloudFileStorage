import { CloudStorageProviderClient } from '../customTypes/GoogleObjects';
import { PassThrough } from 'stream';

export interface IPlatform {
    readonly [index: string]: any;
    // Auth flow
    createAuthUrl? (credentials: Record<string, string>, instanceKey: string): string,
    getTokens? (code: string, instanceKey: string): Record<string, any>;

    // Upload flow
    authorize(instanceKey: string): Promise<CloudStorageProviderClient>;
    initUpload(instanceKey: string, oAuth2Client: CloudStorageProviderClient, uploadStream: PassThrough, fileDetailsMap: Record<string, FileDetail>, fileDetailKey: string): Promise<any>;
    uploadFile(fileDetails: FileDetail, payload: Record<string, any>): Promise<void>;
    endUpload(fileDetails: FileDetail): Promise<GoogleFile>;

    // fileop
    // methods are marked optional (?) as Google has yet to implement these methods
    getFile?(instanceKey: string, fileId: string): Promise<Record<string, string>>;
    cloneFile?(instanceKeyOrOrgUrl: string, fileId: string, fileName: string, folderName: string): Promise<Record<string, string>>;
    createFile?(instanceKey: string, type: string, fileName: string, destinationFolderId: string): Promise<string> | Promise<Record<string, string>>;
    deleteFile?(instanceKey: string, docId: string): Promise<Record<string, string>>;
    downloadFile?(instanceKeyOrOrgUrl: string, fileId: string): Promise<string>;
    supersedeFile?(instanceKey: string, fileType: string, fileName: string, docId: string): Promise<string>;
    updateFile?(instanceKey: string, fileId: string, fileOptions: Record<string, any>): Promise<Record<string, string>>;
    searchFile?(instanceKey: string, searchString: string): Promise<Record<string, string>[]>;

    // permissions
    permissionCreate?(instanceKey: string, fileId: string, newPermission: Record<string, string>): Promise<Record<string, string>>;
    permissionDelete?(instanceKey: string, fileId: string, permissionId: string): Promise<void>;
    permissionList?(instanceKey: string, fileId: string): Promise<Record<string, string>[]>;
    permissionUpdate?(instanceKey: string, fileId:string, permissionId: string, permissionRole: string): Promise<Record<string, string>>;

    // miscellaneous
    getCurrentUser?(instanceKey: string): Promise<Record<string, string>>;
}
