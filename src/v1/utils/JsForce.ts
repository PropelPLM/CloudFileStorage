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
import {
    jwtSession,
    PropelAuthRequest
} from '@propelsoftwaresolutions/propel-sfdc-connect';
import axios, { AxiosRequestConfig } from 'axios';

const CUSTOM_SUFFIX = '__c',
    EXTERNAL_CONTENT_LOCATION = 'E',
    NEW_CUSTOM_SETTING = 'Cloud_File_Storage__c',
    OLD_CUSTOM_SETTING = 'Cloud_Storage__c';

export const getSessionId = async (authRequest: PropelAuthRequest) => {
    const session = await jwtSession({
        clientId: process.env.CLOUD_FILE_STORAGE_CLIENT_ID as string,
        isTest: authRequest.isTest,
        privateKey: process.env.CLOUD_FILE_STORAGE_KEY,
        user: authRequest.user
    });
    return session.access_token;
};

function removeFileFromDisk(fileName: string) {
    fs.unlink(fileName, (e) => {
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
        const newSetting = {
            Name: 'GoogleDrive',
            Access_Token__c: tokens.access_token,
            Refresh_Token__c: tokens.refresh_token,
            Expiry_Date__c: tokens.expiry_date + '',
            Client_Id__c: tokens.clientId,
            Client_Secret__c: tokens.clientSecret
        };

        try {
            let salesforceUrl: string, sessionId: string, orgNamespace: string;
            ({ salesforceUrl, sessionId } = await InstanceManager.get(
                instanceKey,
                [MapKey.salesforceUrl, MapKey.sessionId]
            ));
            const connection = new jsConnect.Connection({
                instanceUrl: salesforceUrl,
                sessionId
            });
            orgNamespace = await this.setupNamespace(connection);
            this.writeTokensOld(newSetting, connection, orgNamespace);
            this.writeTokensNew(
                newSetting,
                orgNamespace,
                salesforceUrl,
                sessionId
            );
            logSuccessResponse(instanceKey, '[JSFORCE.SEND_TOKENS]');
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
                toReplaceId: string,
                fileExtension: string | undefined,
                fileSize: number | undefined,
                orgNamespace: string,
                webContentLink: string | undefined; // newly created file
            ({
                revisionId,
                isNew,
                isPLM,
                salesforceUrl,
                sessionId,
                orgNamespace,
                toReplaceId
            } = await InstanceManager.get(instanceKey, [
                MapKey.revisionId,
                MapKey.isNew,
                MapKey.isPLM,
                MapKey.salesforceUrl,
                MapKey.sessionId,
                MapKey.orgNamespace,
                MapKey.toReplaceId
            ]));

            const connection = new jsConnect.Connection({
                instanceUrl: salesforceUrl,
                sessionId,
                version: '49.0'
            });
            orgNamespace =
                orgNamespace ?? (await this.setupNamespace(connection));

            let sObjectWithNamespace: string,
                newAttachment: Record<string, string | number | undefined>;
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
                        : `${orgNamespace}Document__c`;
                newAttachment = {
                    Document_Title__c: name,
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
                        : `${orgNamespace}Digital_Asset__c`;
                newAttachment = {
                    Content_Location__c: platform,
                    External_File_Id__c: id,
                    Mime_Type__c: fileExtension,
                    Size__c: fileSize!,
                    View_Link__c: webViewLink
                };
                if ((isNew === 'true' || isNew) && toReplaceId) {
                    newAttachment.Id = toReplaceId;
                }
            }

            const baseSObject = connection.sobject(sObjectWithNamespace);
            const sObject =
                newAttachment.Id == null
                    ? await baseSObject.create({
                          Name: this.truncateFileNameToMaxCharacters(name),
                          ...this.addNamespace(newAttachment, orgNamespace)
                      })
                    : await baseSObject.upsert(
                          {
                              Name: this.truncateFileNameToMaxCharacters(name),
                              ...this.addNamespace(newAttachment, orgNamespace)
                          },
                          'Id'
                      );
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
        let salesforceUrl: string, sessionId: string, orgNamespace: string;
        try {
            ({ salesforceUrl, sessionId, orgNamespace } =
                await InstanceManager.get(instanceKey, [
                    MapKey.salesforceUrl,
                    MapKey.sessionId,
                    MapKey.orgNamespace
                ]));
            const connection = new jsConnect.Connection({
                instanceUrl: salesforceUrl,
                sessionId
            });
            orgNamespace = orgNamespace ?? this.setupNamespace(connection);
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
    addNamespace(
        customObject: Record<string, string | number | undefined>,
        orgNamespace: string
    ) {
        if (!orgNamespace) return customObject;
        for (const key in customObject) {
            if (
                key.substring(key.length - CUSTOM_SUFFIX.length) !==
                CUSTOM_SUFFIX
            )
                continue;

            Object.defineProperty(
                customObject,
                `${orgNamespace}${key}`,
                Object.getOwnPropertyDescriptor(customObject, key)!
            );
            delete customObject[key];
        }
        logSuccessResponse(customObject, '[JSFORCE.ADD_NAMESPACE');
        return customObject;
    },

    truncateFileNameToMaxCharacters(fileName: string) {
        if (fileName.length > 75) {
            return (
                fileName.substring(0, 75).trim() +
                fileName.substring(fileName.lastIndexOf('.'))
            );
        } else {
            return fileName;
        }
    },

    async postToChatter(fileName: string, sessionId: string, hostName: string) {
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

        const req: any = https.request(options, (res) => {
            let data = '';
            res.on('data', (d) => (data += d.toString()));
            res.on('end', () =>
                logSuccessResponse(
                    {
                        data,
                        statusCode: res.statusCode,
                        statusMessage: res.statusMessage
                    },
                    'JSFORCE.POST_TO_CHATTER'
                )
            );
            console.log('response: ', res.statusCode, res.statusMessage);
        });

        req.on('error', (err: any) => {
            logErrorResponse(err, '[JSFORCE.POST_TO_CHATTER]');
        });

        // write data to request body
        const fullName = `./tmp/${fileName}`;
        req.write(data);
        fs.createReadStream(fullName)
            .on('end', function () {
                removeFileFromDisk(fullName);
                req.end(CRLF + '--' + boundary + '--' + CRLF);
            })
            .pipe(req, { end: false });

        logSuccessResponse(fileName, '[JSFORCE.POST_TO_CHATTER_CLEAN_UP]');
    },

    async setupNamespace(connection: any): Promise<string> {
        try {
            const jsForceRecords = await connection.query(
                "SELECT NamespacePrefix FROM ApexClass WHERE Name = 'SoslBuilder' LIMIT 1"
            );
            const orgNamespace: string =
                jsForceRecords.records[0].NamespacePrefix + '__';
            logSuccessResponse({ orgNamespace }, '[JSFORCE.SETUP_NAMESPACE]');
            return orgNamespace;
        } catch (err) {
            logErrorResponse(err, '[JSFORCE.SETUP_NAMESPACE]');
            throw err;
        }
    },

    async writeTokensOld(
        tokens: Record<string, string | number>,
        connection: any,
        orgNamespace: string
    ) {
        try {
            await connection
                .sobject(`${orgNamespace}${OLD_CUSTOM_SETTING}`)
                .upsert({ ...this.addNamespace(tokens, orgNamespace) }, 'Name');
            logSuccessResponse({}, '[JSFORCE.WRITE_OLD]');
        } catch (err) {
            logErrorResponse(err, '[JSFORCE.WRITE_OLD]');
            throw err;
        }
    },

    async writeTokensNew(
        tokens: Record<string, string | number>,
        orgNamespace: string,
        salesforceUrl: string,
        sessionId: string
    ) {
        const vfSubdomainRegex = new RegExp(/--[\w]{3,8}.vf\.force\.com/, 'g');
        const regexIndex = salesforceUrl.search(vfSubdomainRegex);
        if (regexIndex != -1) {
            salesforceUrl =
                salesforceUrl.slice(0, regexIndex) + '.my.salesforce.com';
        }
        if (orgNamespace.endsWith('__')) {
            orgNamespace = orgNamespace.slice(0, -2);
        }
        try {
            const url = `${salesforceUrl}/services/apexrest/${orgNamespace}/configuration/`,
                reqBody = {
                    settingName: NEW_CUSTOM_SETTING,
                    payload: tokens
                };
            const options: AxiosRequestConfig = {
                method: 'POST',
                headers: { Authorization: 'OAuth ' + sessionId },
                data: reqBody,
                url,
                validateStatus: (status) => status < 400
            };
            await axios(options).catch((err) => {
                throw err;
            });
            logSuccessResponse({}, '[JSFORCE.WRITE_NEW]');
        } catch (err) {
            logErrorResponse(err, '[JSFORCE.WRITE_NEW]');
        }
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
