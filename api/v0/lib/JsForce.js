"use strict";

const jsConnect = require("jsforce");
const InstanceManager = require("../InstanceManager.js");

async function connect(sessionId, salesforceUrl, instanceKey) {
  try {
    const connection = new jsConnect.Connection({
      instanceUrl: salesforceUrl,
      sessionId
    });
    await Promise.all([
      InstanceManager.add(instanceKey, { connection }),
      setupNamespace(instanceKey)
    ]);
  } catch (err) {
    console.log(`Log in failed: ${err}`);
  }
}

async function sendTokens(tokens, instanceKey) {
  const newSetting = {
    "Access_Token__c": tokens.access_token,
    "Refresh_Token__c": tokens.refresh_token,
    "Expiry_Date__c": tokens.expiry_date,
    "Client_Id__c": tokens.clientId,
    "Client_Secret__c": tokens.clientSecret,
  }

  let connection, orgNamespace;
  ({ connection, orgNamespace } = await InstanceManager.get(instanceKey, ["connection", "orgNamespace"]));
  return connection
    .sobject(`${orgNamespace}__Cloud_Storage__c`)
    .upsert({
      ...await addNamespace(newSetting, instanceKey)
    }, `${orgNamespace}__Client_Id__c`);
}

async function setupNamespace(instanceKey) {
  let connection;
  ({ connection } = await InstanceManager.get(instanceKey, ["connection"]));
  const jsForceRecords = await connection.query("SELECT NamespacePrefix FROM ApexClass WHERE Name = 'CloudStorageService' LIMIT 1");
  const orgNamespace = jsForceRecords.records[0].NamespacePrefix;
  InstanceManager.add(instanceKey, { orgNamespace });
}

async function create(file, instanceKey) {
  let connection, orgNamespace, revisionId, name, webViewLink, id, fileExtension, webContentLink;
  ({ connection, orgNamespace, revisionId } = await InstanceManager.get(instanceKey, ["connection", "orgNamespace", "revisionId"]));
  ({ name, webViewLink, id, fileExtension, webContentLink } = file);
  const newAttachment = {
    "Item_Revision__c": revisionId,
    "External_Attachment_URL__c": webViewLink,
    "File_Extension__c": fileExtension,
    "Google_File_Id__c": id,
    "External_Attachment_Download_URL__c": webContentLink,
    "Content_Location__c": "E"
  };
  const sObject = await connection
      .sobject(`${orgNamespace}__Document__c`)
      .create({
        Name: name,
        ...await addNamespace(newAttachment, instanceKey)
      });
  return {...sObject, revisionId};
}

async function addNamespace(customObject, instanceKey) {
  let orgNamespace;
  ({ orgNamespace } = await InstanceManager.get(instanceKey, ["orgNamespace"]));
  for (const key in customObject) {
    Object.defineProperty(
      customObject,
      `${orgNamespace}__${key}`,
      Object.getOwnPropertyDescriptor(customObject, key)
    );
    delete customObject[key]
  }
  return customObject;
}

module.exports = {
  connect,
  create,
  sendTokens
};
