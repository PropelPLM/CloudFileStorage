const jsConnect = require("jsforce");
var connection;
var nameSpace;
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

async function updateRevId(revId) {
  revisionId = revId;
}

async function credentialsCheck() { }

async function setup() {
  credentialsCheck();
  connection.query(
    "SELECT NamespacePrefix FROM ApexClass WHERE Name = 'CloudStorageService' LIMIT 1"
  ).then(res => {
    nameSpace = res.records[0].NamespacePrefix
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

  for (key in newAttachment) {
    Object.defineProperty(newAttachment, `${nameSpace}__${key}`,
      Object.getOwnPropertyDescriptor(newAttachment, key));
    delete newAttachment[key]
  };

  return connection
    .sobject(`${nameSpace}__Document__c`)
    .create({
      Name: name,
      ...newAttachment
    })
}

module.exports = {
  connect,
  create,
  updateRevId
};
