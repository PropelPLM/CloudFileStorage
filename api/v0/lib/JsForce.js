"use strict";

const jsConnect = require("jsforce");
const InstanceManager = require("../InstanceManager.js");
var revisionId;

async function connect(sessionId, salesforceUrl, instanceKey) {
  try {
    const connection = new jsConnect.Connection({
      instanceUrl: salesforceUrl,
      sessionId
    });
    InstanceManager.add(instanceKey, 'connection', connection);
    setup(instanceKey);
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
  ({ connection, namespace } = InstanceManager.get(instanceKey, ['connection', 'namespace']));
  return connection
    .sobject(`${namespace}__Cloud_Storage__c`)
    .upsert({
      ...addNamespace(newSetting, instanceKey)
    }, `${namespace}__Client_Id__c`)
}

async function setup(instanceKey) {
  ({ connection } = InstanceManager.get(instanceKey, ['connection']));
  connection.query(
    "SELECT NamespacePrefix FROM ApexClass WHERE Name = 'CloudStorageService' LIMIT 1"
  ).then(res => {
    const namespace = res.records[0].NamespacePrefix;
    InstanceManager.add(instanceKey, 'namespace', namespace);
  }).catch(err => {
    console.log(`error setting up: ${err}`);
  });
}

async function create(file, instanceKey) {
  ({ connection, namespace, revisionId } = InstanceManager.get(instanceKey, ['connection', 'namespace', 'revisionId']));
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
      .sobject(`${namespace}__Document__c`)
      .create({
        Name: name,
        ...addNamespace(newAttachment, instanceKey)
      });
  return {...sObject, revisionId};
}

function addNamespace(customObject, instanceKey) {
  ({ namespace } = InstanceManager.get(instanceKey, ['namespace']));
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
  sendTokens
};
