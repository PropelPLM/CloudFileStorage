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
    "Name": "GoogleDrive",
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
    }, "Name")
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

function create(file) {
  ({ name, webViewLink, id, fileExtension, webContentLink } = file);
  const newAttachment = {
    "Item_Revision__c": revisionId,
    "External_Attachment_URL__c": webViewLink,
    "File_Extension__c": fileExtension,
    "Google_File_Id__c": id,
    "External_Attachment_Download_URL__c": webContentLink,
    "Content_Location__c": 'E'
  };

  return connection
    .sobject(`${namespace}__Document__c`)
    .create({
      Name: name,
      ...addNamespace(newAttachment)
    })
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

module.exports = {
  connect,
  create,
  updateRevId,
  sendTokens
};
