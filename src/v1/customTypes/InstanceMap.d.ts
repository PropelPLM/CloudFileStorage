type IMap = {
    [key in MapKey]: any;
};

type FileDetail = {
    fileName: string;
    externalBytes: number;
    fileSize: number;
    frontendBytes: number;
    mimeType: string;
    uploadStream: any;
    file?: any;
};

const enum MapKey {
    // platform agnostic information
    platform = 'platform',
    clientId = 'clientId',
    clientSecret = 'clientSecret',
    destinationFolderId = 'destinationFolderId',
    oAuth2Client = 'oAuth2Client',

    // jsforce
    sessionId = 'sessionId',
    connection = 'connection',
    salesforceUrl = 'salesforceUrl',
    orgNamespace = 'orgNamespace',
    revisionId = 'revisionId',
    toReplaceId = 'toReplaceId',

    // operations
    fileDetails = 'fileDetails',
    isNew = 'isNew',
    isPLM = 'isPLM',
    uploadLimit = 'uploadLimit',

    // office specific information
    groupId = 'groupId',
    tenantId = 'tenantId',

    //v1
    accessToken = 'accessToken',
    refreshToken = 'refreshToken',
    expiryDate = 'expiryDate'
}
