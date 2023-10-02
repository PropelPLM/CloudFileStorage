type IMap = {
    [key in MapKey]: any;
  };

type FileDetail = {
  fileName: string;
  externalBytes: number;
  fileSize: number;
  frontendBytes: number;
  file?: any;
  uploadStream?: any;
  mimeType?: string;
};

const enum MapKey {

  // platform agnostic information
  platform = "platform",
  clientId = "clientId",
  clientSecret = "clientSecret",
  destinationFolderId = "destinationFolderId",
  oAuth2Client = "oAuth2Client",
  orgId = "orgId",

  // jsforce
  connection = "connection",
  salesforceUrl = "salesforceUrl",
  orgNamespace = "orgNamespace",
  revisionId = "revisionId",

  // operations
  fileDetails = "fileDetails",
  isNew = "isNew",

  // office specific information
  groupId = "groupId",
  tenantId = "tenantId",

}
