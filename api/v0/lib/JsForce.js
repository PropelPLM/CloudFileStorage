'use strict';

const jsConnect = require('jsforce');
const { logSuccessResponse, logErrorResponse } = require('../Logger.js');
const InstanceManager = require('../InstanceManager.js');

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
    logSuccessResponse({}, '[JSFORCE.CONNECT]');
  } catch (err) {
    logErrorResponse(err, '[JSFORCE.CONNECT]');
  }
}

async function sendTokens(tokens, instanceKey) {
  const newSetting = {
    Access_Token__c: tokens.access_token,
    Refresh_Token__c: tokens.refresh_token,
    Expiry_Date__c: tokens.expiry_date,
    Client_Id__c: tokens.clientId,
    Client_Secret__c: tokens.clientSecret
  };

  let connection, orgNamespace;
  ({ connection, orgNamespace } = InstanceManager.get(instanceKey, ['connection', 'orgNamespace']));
  logSuccessResponse({}, '[JSFORCE.SEND_TOKENS]');
  return connection
    .sobject(`${orgNamespace}__Cloud_Storage__c`)
    .upsert({ ...(await addNamespace(newSetting, instanceKey)) },`${orgNamespace}__Client_Id__c`);
}

async function setupNamespace(instanceKey) {
  let connection;
  ({ connection } = InstanceManager.get(instanceKey, ['connection']));
  const jsForceRecords = await connection.query(
    'SELECT NamespacePrefix FROM ApexClass WHERE Name = \'CloudStorageService\' LIMIT 1'
  );
  const orgNamespace = jsForceRecords.records[0].NamespacePrefix;
  InstanceManager.add(instanceKey, { orgNamespace });
  logSuccessResponse({ orgNamespace }, '[JSFORCE.SETUP_NAMESPACE]');
}

async function create(file, instanceKey) {
  try {
    let connection, orgNamespace, revisionId, isNew, name, webViewLink, id, fileExtension, webContentLink;
    ({ connection, orgNamespace, revisionId, isNew } = InstanceManager.get(instanceKey, ['connection', 'orgNamespace', 'revisionId', 'isNew']));

    ({ name, webViewLink, id, fileExtension, webContentLink } = file);
    const newAttachment = {
      External_Attachment_URL__c: webViewLink,
      File_Extension__c: fileExtension,
      Google_File_Id__c: id,
      External_Attachment_Download_URL__c: webContentLink,
      Content_Location__c: 'E'
    };

    if (!isNew) {
      newAttachment['Item_Revision__c'] = revisionId;
    }

    const sObject = await connection
      .sobject(`${orgNamespace}__Document__c`)
      .create({
        Name: name,
        ...(await addNamespace(newAttachment, instanceKey))
      });
    logSuccessResponse({ sObject }, '[JSFORCE.CREATE]');
    return { ...sObject, revisionId };
  } catch (err) {
    logErrorResponse({ err }, '[JSFORCE.CREATE]');
  }
}

async function addNamespace(customObject, instanceKey) {
  let orgNamespace;
  ({ orgNamespace } = InstanceManager.get(instanceKey, ['orgNamespace']));
  for (const key in customObject) {
    Object.defineProperty(
      customObject,
      `${orgNamespace}__${key}`,
      Object.getOwnPropertyDescriptor(customObject, key)
    );
    delete customObject[key];
  }
  return customObject;
}

module.exports = {
  connect,
  create,
  sendTokens
};
