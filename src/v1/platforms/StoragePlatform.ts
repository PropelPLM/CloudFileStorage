import { PassThrough } from 'stream';

export type DADownloadDetails = {
    fileId: string;
    fileName?: string;
    key?: string;
    mimeType?: string;
};

export type DownloadParams = {
    instanceKeyOrOrgUrlOrOrgId: string;
    daDownloadDetailsList: Array<DADownloadDetails>;
    sessionId: string;
    hostName: string;
    zipFileName: string;
};

export interface StoragePlatform {
    readonly [index: string]: any;
    // Auth flow
    createAuthUrl?(
        credentials: Record<string, string>,
        instanceKey: string
    ): string;
    getTokens?(
        code: string,
        instanceKey: string,
        hostName: string
    ): Record<string, any>;
    createSetupFolders(): Promise<Record<FolderNameEnum, string>>;

    // Upload flow
    initUpload(
        instanceKey: string,
        uploadStream: PassThrough,
        fileDetailsMap: Record<string, FileDetail>,
        fileDetailKey: string
    ): Promise<any>;
    uploadFile(
        fileDetailsMap: Record<string, FileDetail>,
        fileDetailKey: string,
        payload: Record<string, any>
    ): Promise<void>;
    endUpload(
        fileDetailsMap: Record<string, FileDetail>,
        fileDetailKey: string
    ): Promise<CreatedFileDetails>;

    // fileop
    // methods are marked optional (?) as Google has yet to implement these methods
    getFile?(
        instanceKey: string,
        fileId: string
    ): Promise<Record<string, string>>;
    cloneFile?(
        instanceKeyOrOrgUrl: string,
        fileId: string,
        fileName: string,
        folderName: string
    ): Promise<Record<string, string>>;
    createFile?(
        instanceKey: string,
        type: string,
        fileName: string,
        destinationFolderId: string
    ): Promise<string> | Promise<Record<string, string>>;
    deleteFile?(
        instanceKey: string,
        docId: string
    ): Promise<Record<string, string>>;
    downloadFile?(options: Partial<DownloadParams>): Promise<string>;
    supersedeFile?(
        instanceKey: string,
        fileType: string,
        fileName: string,
        docId: string
    ): Promise<string>;
    updateFile?(
        instanceKey: string,
        fileId: string,
        fileOptions: Record<string, any>
    ): Promise<Record<string, string>>;
    searchFile?(
        instanceKey: string,
        searchString: string
    ): Promise<Record<string, string>[]>;

    // permissions
    permissionCreate?(
        instanceKey: string,
        fileId: string,
        newPermission: Record<string, string>
    ): Promise<Record<string, string>>;
    permissionDelete?(
        instanceKey: string,
        fileId: string,
        permissionId: string
    ): Promise<void>;
    permissionList?(
        instanceKey: string,
        fileId: string
    ): Promise<Record<string, string>[]>;
    permissionUpdate?(
        instanceKey: string,
        fileId: string,
        permissionId: string,
        permissionRole: string
    ): Promise<Record<string, string>>;

    // miscellaneous
    getCurrentUser?(instanceKey: string): Promise<Record<string, string>>;
}

export type PlatformIdentifier = 'googledrive' | 'aws' | 'office365';

export class CreatedFileDetails {
    constructor(
        public status: number,
        public id: string,
        public name: string,
        public webViewLink: string,
        public fileExtension: string | undefined,
        public platform: PlatformIdentifier
    ) {}
    public webContentLink?: string;
    public fileSize?: number;
}
