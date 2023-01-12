'use strict';

import jsConnect from 'jsforce-propel';

import { logSuccessResponse, logErrorResponse } from '../utils/Logger';
import InstanceManager from '../utils/InstanceManager';
import {
    CreatedFileDetails,
    PlatformIdentifier
} from '../platforms/StoragePlatform';
import { v4 as uuidv4 } from 'uuid';
import https from 'https';
import fs from 'fs';

const CUSTOM_SUFFIX = '__c';
const EXTERNAL_CONTENT_LOCATION = 'E';

function removeFileFromDisk(fileName: string) {
  fs.unlink(fileName, e => {
    if (e) {
      console.log('unlink error:', e);
    }
  });
}

export default {
    async connect(
        sessionId: string,
        salesforceUrl: string,
        instanceKey: string
    ) {
        console.log(sessionId, salesforceUrl, instanceKey);
    },

    async sendTokens(
        tokens: Record<string, string | number>,
        instanceKey: string
    ) {
        let salesforceUrl: string, sessionId: string; //jsforce
        ({ salesforceUrl, sessionId } = await InstanceManager.get(instanceKey, [
            MapKey.salesforceUrl,
            MapKey.sessionId
        ]));
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
                .upsert(
                    { ...this.addNamespace(newSetting, orgNamespace) },
                    'Name'
                );

            logSuccessResponse({}, '[JSFORCE.SEND_TOKENS]');
        } catch (err) {
            logErrorResponse(err, '[JSFORCE.SEND_TOKENS]');
            throw err;
        }
    },

    async create(file: CreatedFileDetails, instanceKey: string) {
        try {
            let salesforceUrl: string,
                sessionId: string, //jsforce
                revisionId: string,
                isNew: string,
                isPLM: string,
                name: string,
                platform: PlatformIdentifier, // SF file creation
                webViewLink: string,
                id: string,
                fileExtension: string,
                fileSize: number | undefined,
                webContentLink: string | undefined; // newly created file
            ({ revisionId, isNew, isPLM, salesforceUrl, sessionId } =
                await InstanceManager.get(instanceKey, [
                    MapKey.revisionId,
                    MapKey.isNew,
                    MapKey.isPLM,
                    MapKey.salesforceUrl,
                    MapKey.sessionId
                ]));

            const connection = new jsConnect.Connection({
                instanceUrl: salesforceUrl,
                sessionId,
                version: '49.0'
            });
            const orgNamespace: string = await this.setupNamespace(connection);
            let sObjectWithNamespace: string,
                newAttachment: Record<string, string | number>;
            ({
                name,
                webViewLink,
                id,
                fileExtension,
                fileSize,
                webContentLink,
                platform
            } = file);

            if (isPLM) {
                sObjectWithNamespace =
                    orgNamespace === null
                        ? 'Document__c'
                        : `${orgNamespace}__Document__c`;
                newAttachment = {
                    External_Attachment_URL__c: webViewLink,
                    File_Extension__c: fileExtension,
                    Google_File_Id__c: id,
                    External_Attachment_Download_URL__c: webContentLink!,
                    Content_Location__c: EXTERNAL_CONTENT_LOCATION
                };
                if (isNew === 'false') {
                    //redis values are stringified.
                    newAttachment['Item_Revision__c'] = revisionId;
                }
            } else {
                sObjectWithNamespace =
                    orgNamespace === null
                        ? 'Digital_Asset__c'
                        : `${orgNamespace}__Digital_Asset__c`;
                newAttachment = {
                    Content_Location__c: platform,
                    External_File_Id__c: id,
                    Mime_Type__c: fileExtension,
                    Size__c: fileSize!,
                    View_Link__c: webViewLink
                };
            }

            const sObject = await connection
                .sobject(sObjectWithNamespace)
                .create({
                    Name: name,
                    ...this.addNamespace(newAttachment, orgNamespace)
                });
            if (!sObject.success)
                throw new Error(
                    `Failed to create SObject: ${sObject.errors.join('\n')}`
                );

            logSuccessResponse({ sObject }, '[JSFORCE.CREATE]');
            return { ...sObject, revisionId };
        } catch (err) {
            logErrorResponse({ err }, '[JSFORCE.CREATE]');
            throw err;
        }
    },

    async upsertCustomMetadata(
        instanceKey: string,
        metadataPairs: Record<string, string>
    ) {
        let salesforceUrl: string, sessionId: string;
        try {
            ({ salesforceUrl, sessionId } = await InstanceManager.get(
                instanceKey,
                [MapKey.salesforceUrl, MapKey.sessionId]
            ));
            const connection = new jsConnect.Connection({
                instanceUrl: salesforceUrl,
                sessionId
            });
            const orgNamespace: string = await this.setupNamespace(connection);
            const metadata: Metadata[] = [];

            Object.entries(metadataPairs).forEach(([key, value]) => {
                if (!key || !value)
                    throw new Error(`Missing key(${key}) or value(${value}).`);
                metadata.push(new Metadata(orgNamespace, key, value));
            });

            await connection.metadata.upsert('CustomMetadata', metadata);
            logSuccessResponse(metadataPairs, '[JSFORCE.INSERT_CUSTOM_MDT]');
        } catch (err) {
            logErrorResponse(err, '[JSFORCE.INSERT_CUSTOM_MDT]');
            throw err;
        }
    },

    // UTILS
    async setupNamespace(connection: any): Promise<string> {
        try {
            const jsForceRecords = await connection.query(
                "SELECT NamespacePrefix FROM ApexClass WHERE Name = 'SoslBuilder' LIMIT 1"
            );
            const orgNamespace: string =
                jsForceRecords.records[0].NamespacePrefix;
            logSuccessResponse({ orgNamespace }, '[JSFORCE.SETUP_NAMESPACE]');
            return orgNamespace;
        } catch (err) {
            logErrorResponse(err, '[JSFORCE.SETUP_NAMESPACE]');
            throw err;
        }
    },

    addNamespace(
        customObject: Record<string, string | number>,
        orgNamespace: string
    ) {
        if (orgNamespace === null) return customObject;
        for (const key in customObject) {
            if (
                key.substring(key.length - CUSTOM_SUFFIX.length) !==
                CUSTOM_SUFFIX
            )
                continue;

            Object.defineProperty(
                customObject,
                `${orgNamespace}__${key}`,
                Object.getOwnPropertyDescriptor(customObject, key)!
            );
            delete customObject[key];
        }
        return customObject;
    },

    async postToChatter(
        fileName: string,
        sessionId: string,
        hostName: string
    ) {
        const boundary = uuidv4();
        const path = '/services/data/v34.0/chatter/feed-elements';
        // if (communityId) {
        //     path = `/services/data/v34.0/connect/communities/${communityId}/chatter/feed-elements`;
        // }

        const options = {
            hostname: hostName,
            path,
            method: 'POST',
            headers: {
                'content-type': 'multipart/form-data; boundary=' + boundary,
                Authorization: 'OAuth ' + sessionId
            }
        };

        const CRLF = '\r\n';
        const data = [
            '--' + boundary,
            'Content-Disposition: form-data; name="json"',
            'Content-Type: application/json; charset=UTF-8',
            '',
            '{',
            '"body":{',
            '"messageSegments":[',
            '{',
            '"type":"Text",',
            '"text":""',
            '}',
            ']',
            '},',
            '"capabilities":{',
            '"content":{',
            `"title":"${fileName}"`,
            '}',
            '},',
            '"feedElementType":"FeedItem",',
            `"subjectId":"me"`,
            '}',
            '',
            '--' + boundary,
            `Content-Disposition: form-data; name="feedElementFileUpload"; filename="${fileName}"`,
            'Content-Type: application/octet-stream; charset=ISO-8859-1',
            '',
            ''
        ].join(CRLF);

        const req: any = https.request(options, res => {
            console.log('response: ', res.statusCode, res.statusMessage);
        });

        req.on('error', (err: any)=> {
            logErrorResponse(err, '[JSFORCE.POST_TO_CHATTER]');
        })

        // write data to request body
        const fullName = `./tmp/${fileName}`;
        req.write(data);
        fs.createReadStream(fullName)
            .on('end', function () {
                removeFileFromDisk(fullName);
                req.end(CRLF + '--' + boundary + '--' + CRLF);
            }).pipe(req, { end: false });

        logSuccessResponse(fileName, '[JSFORCE.POST_TO_CHATTER]');
    }
};

class Metadata {
    fullName: string;
    label: string;
    values: { field: string; value: string };

    constructor(
        namespace: string,
        metadataName: string,
        metadataValue: string
    ) {
        (this.fullName = `${
            namespace + '__'
        }Configuration__mdt.${metadataName}`),
            (this.label = metadataName),
            (this.values = {
                field: `${namespace + '__'}Value__c`,
                value: metadataValue
            });
    }
}
