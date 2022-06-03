'use strict';

import jsConnect from 'jsforce';

import { logSuccessResponse, logErrorResponse } from '../utils/Logger';
import InstanceManager from '../utils/InstanceManager';
import { CreatedFileDetails, PlatformIdentifier } from '../platforms/StoragePlatform';

const CUSTOM_SUFFIX = '__c';
const EXTERNAL_CONTENT_LOCATION = 'E';

export default {
  async connect(sessionId: string, salesforceUrl: string, instanceKey: string) {
    console.log(sessionId, salesforceUrl, instanceKey);
  },

  async sendTokens(tokens: Record<string, string|number>, instanceKey: string) {
    let salesforceUrl: string, sessionId: string; //jsforce
    ({ salesforceUrl, sessionId } = await InstanceManager.get(instanceKey, [ MapKey.salesforceUrl, MapKey.sessionId]));
    const connection = new jsConnect.Connection({
      instanceUrl: salesforceUrl,
      sessionId
    });
    const orgNamespace: string = await this.setupNamespace(connection);
    const newSetting = {
      Name: 'GoogleDrive',
      Access_Token__c: tokens.access_token,
      Refresh_Token__c: tokens.refresh_token,
      Expiry_Date__c: tokens.expiry_date,
      Client_Id__c: tokens.clientId,
      Client_Secret__c: tokens.clientSecret
    };

    try {
      await connection
        .sobject(`${orgNamespace}__Cloud_File_Storage__c`)
        .upsert({ ...(await this.addNamespace(newSetting, orgNamespace)) }, 'Name');

      logSuccessResponse({}, '[JSFORCE.SEND_TOKENS]');
    } catch (err) {
      logErrorResponse(err, '[JSFORCE.SEND_TOKENS]');
      throw(err);
    }
  },

  async create(file: CreatedFileDetails, instanceKey: string) {
    try {
      let salesforceUrl: string, sessionId: string, //jsforce
          revisionId: string, isNew: string, isPLM: string, name: string, platform: PlatformIdentifier, // SF file creation
          webViewLink: string, id: string, fileExtension: string, fileSize: number | undefined, webContentLink: string | undefined; // newly created file
          ({ revisionId, isNew, isPLM, salesforceUrl, sessionId } = await InstanceManager.get(instanceKey, [ MapKey.revisionId, MapKey.isNew, MapKey.isPLM, MapKey.salesforceUrl, MapKey.sessionId]));

      const connection = new jsConnect.Connection({
        instanceUrl: salesforceUrl,
        sessionId
      });
      const orgNamespace: string = await this.setupNamespace(connection);
      let sObjectWithNamespace: string, newAttachment: Record<string, string | number>;
      ({ name, webViewLink, id, fileExtension, fileSize, webContentLink, platform } = file);

      if (isPLM) {
        sObjectWithNamespace = `${orgNamespace}__Document__c`;
        newAttachment = {
          External_Attachment_URL__c: webViewLink,
          File_Extension__c: fileExtension,
          Google_File_Id__c: id,
          External_Attachment_Download_URL__c: webContentLink!,
          Content_Location__c: EXTERNAL_CONTENT_LOCATION
        };
        if (isNew === 'false') { //redis values are stringified.
          newAttachment['Item_Revision__c'] = revisionId;
        }
      } else {
        sObjectWithNamespace = `${orgNamespace}__Digital_Asset__c`;
        newAttachment = {
          View_Link__c: webViewLink,
          Content_Location__c: platform,
          External_File_Id__c: id,
          Mime_Type__c: fileExtension,
          Size__c: fileSize!
        };
      }


      const sObject = await connection
        .sobject(sObjectWithNamespace)
        .create({
          Name: name,
          ...(await this.addNamespace(newAttachment, orgNamespace))
        });
      if (!sObject.success) throw new Error(`Failed to create Document__c: ${sObject.errors.join('\n')}`);

      logSuccessResponse({ sObject }, '[JSFORCE.CREATE]');
      return { ...sObject, revisionId };
    } catch (err) {
      logErrorResponse({ err }, '[JSFORCE.CREATE]');
      throw(err);
    }
  },

  // UTILS
  async setupNamespace(connection: any): Promise<string> {
    try {
      const jsForceRecords = await connection.query(
        'SELECT NamespacePrefix FROM Organization'
      );
      const orgNamespace: string = jsForceRecords.records[0].NamespacePrefix;
      logSuccessResponse({ orgNamespace }, '[JSFORCE.SETUP_NAMESPACE]');
      return orgNamespace;
    } catch (err) {
      logErrorResponse(err, '[JSFORCE.SETUP_NAMESPACE]');
      throw(err);
    }
  },

  async addNamespace(customObject: Record<string, string | number>, orgNamespace: string) {
    for (const key in customObject) {
      if (key.substring(key.length - CUSTOM_SUFFIX.length) !== CUSTOM_SUFFIX) continue;

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
