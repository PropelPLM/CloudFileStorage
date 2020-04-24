const jsConnect = require("jsforce");
var connection;
var namespace;
var revisionId;

async function connect(sessionId, salesforceUrl) {
  try {
    connection = new jsConnect.Connection({
      instanceUrl: salesforceUrl,
      sessionId
    });
    setup();
  } catch (err) {
    console.log(`Log in failed: ${err}`);
  }
}

function updateRevId(revId) {
  revisionId = revId;
}

async function sendTokens(tokens) {
  const newSetting = {
    "Access_Token__c": tokens.access_token,
    "Refresh_Token__c": tokens.refresh_token,
    "Expiry_Date__c": tokens.expiry_date,
    "Client_Id__c": tokens.clientId,
    "Client_Secret__c": tokens.clientSecret,
  }
  return connection
    .sobject(`${namespace}__Cloud_Storage__c`)
    .upsert({
      ...addNamespace(newSetting)
    }, `${namespace}__Client_Id__c`)
}

async function setup() {
  connection.query(
    "SELECT NamespacePrefix FROM ApexClass WHERE Name = 'CloudStorageService' LIMIT 1"
  ).then(res => {
    namespace = res.records[0].NamespacePrefix
  }).catch(err => {
    console.log(`error setting up: ${err}`);
  })
}

async function create(file) {
  console.log('revisionId', revisionId);
  ({ name, webViewLink, id, fileExtension, webContentLink } = file);
  const newAttachment = {
    "External_Attachment_URL__c": webViewLink,
    "File_Extension__c": fileExtension,
    "Google_File_Id__c": id,
    "External_Attachment_Download_URL__c": webContentLink,
    "Content_Location__c": 'E'
  };
  if (revisionId) {
    newAttachment["Item_Revision__c"] = revisionId

    return connection
    .sobject(`${namespace}__Document__c`)
    .create({
      Name: name,
      ...addNamespace(newAttachment)
    })
  }
  return addNamespace(newAttachment)
}

function addNamespace(customObject) {
  for (key in customObject) {
    Object.defineProperty(
      customObject,
      `${namespace}__${key}`,
      Object.getOwnPropertyDescriptor(customObject, key)
    );
    delete customObject[key]
  }
  return customObject;
}

function sendErrorResponse(error, functionName) {
  console.log(`${functionName} has failed due to error: ${error}.`);
  return error;
}

module.exports = {
  connect,
  create,
  updateRevId,
  sendTokens
};
