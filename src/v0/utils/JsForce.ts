'use strict';

import jsConnect from 'jsforce';

import { logSuccessResponse, logErrorResponse } from '../utils/Logger';
import InstanceManager from '../utils/InstanceManager';
import MessageEmitter from '../utils/MessageEmitter';

export class JsForce {
  public constructor(){}
  
  public async connect(sessionId: string, salesforceUrl: string, instanceKey: string) {
    try {
      const connection = new jsConnect.Connection({
        instanceUrl: salesforceUrl,
        sessionId
      });
      await Promise.all([
        InstanceManager.add(instanceKey, { connection }),
        this.setupNamespace(instanceKey)
      ]);
      logSuccessResponse({}, '[JSFORCE.CONNECT]');
    } catch (err) {
      logErrorResponse(err, '[JSFORCE.CONNECT]');
    }
  }

  public async sendTokens(tokens: Record<string, string>, instanceKey: string) {
    const newSetting = {
      Access_Token__c: tokens.access_token,
      Refresh_Token__c: tokens.refresh_token,
      Expiry_Date__c: tokens.expiry_date,
      Client_Id__c: tokens.clientId,
      Client_Secret__c: tokens.clientSecret
    };

    let connection: any, orgNamespace: string;
    ({ connection, orgNamespace } = InstanceManager.get(instanceKey, ['connection', 'orgNamespace']));
    try {
      const upsertedTokens = await connection
        .sobject(`${orgNamespace}__Cloud_Storage__c`)
        .upsert({ ...(await this.addNamespace(newSetting, instanceKey)) },`${orgNamespace}__Client_Id__c`);

      logSuccessResponse(upsertedTokens, '[JSFORCE.SEND_TOKENS]');
      MessageEmitter.postTrigger(instanceKey, 'authComplete', {});
    } catch (err) {
      logSuccessResponse(err, '[JSFORCE.SEND_TOKENS]');
    }
  }

  public async create(file: Record<string, string>, instanceKey: string) {
    try {
      let connection: any, orgNamespace: string, revisionId: string, isNew: string, name: string,
          webViewLink: string, id: string, fileExtension: string, webContentLink: string;
      ({ connection, orgNamespace, revisionId, isNew } = InstanceManager.get(instanceKey, ['connection', 'orgNamespace', 'revisionId', 'isNew']));

      ({ name, webViewLink, id, fileExtension, webContentLink } = file);
      const newAttachment: Record<string, string> = {
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
          ...(await this.addNamespace(newAttachment, instanceKey))
        });
      logSuccessResponse({ sObject }, '[JSFORCE.CREATE]');
      return { ...sObject, revisionId };
    } catch (err) {
      logErrorResponse({ err }, '[JSFORCE.CREATE]');
    }
  }

  // UTILS
  public async setupNamespace(instanceKey: string) {
    let connection: any;
    ({ connection } = InstanceManager.get(instanceKey, ['connection']));
    const jsForceRecords = await connection.query(
      'SELECT NamespacePrefix FROM ApexClass WHERE Name = \'CloudStorageService\' LIMIT 1'
    );
    const orgNamespace: string = jsForceRecords.records[0].NamespacePrefix;
    InstanceManager.add(instanceKey, { orgNamespace });
    logSuccessResponse({ orgNamespace }, '[JSFORCE.SETUP_NAMESPACE]');
  }

  public async addNamespace(customObject: Record<string, string>, instanceKey: string) {
    let orgNamespace: string;
    ({ orgNamespace } = InstanceManager.get(instanceKey, ['orgNamespace']));
    for (const key in customObject) {
      Object.defineProperty(
        customObject,
        `${orgNamespace}__${key}`,
        Object.getOwnPropertyDescriptor(customObject, key)!
      );
      delete customObject[key];
    }
    return customObject;
  }
}

export default new JsForce();
