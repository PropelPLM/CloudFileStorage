type IMap = {
    [key in MapKey]: any;
  };
  
  enum MapKey {
    clientId = "clientId",
    clientSecret = "clientSecret",
    connection = "connection",
    destinationFolderId = "destinationFolderId",
    externalBytes = "externalBytes",
    file = "file",
    fileName = "fileName",
    fileSize = "fileSize",
    frontendBytes = "frontendBytes",
    isNew = "isNew",
    oAuth2Client = "oAuth2Client",
    orgNamespace = "orgNamespace",
    revisionId = "revisionId",
    salesforceUrl = "salesforceUrl",
    sessionId = "sessionId",
    uploadStream = "uploadStream",
  }