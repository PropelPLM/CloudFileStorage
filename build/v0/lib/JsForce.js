'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsConnect = require('jsforce');
const { logSuccessResponse, logErrorResponse } = require('./Logger');
const InstanceManager = require('./InstanceManager');
function connect(sessionId, salesforceUrl, instanceKey) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const connection = new jsConnect.Connection({
                instanceUrl: salesforceUrl,
                sessionId
            });
            yield Promise.all([
                InstanceManager.add(instanceKey, { connection }),
                setupNamespace(instanceKey)
            ]);
            logSuccessResponse({}, '[JSFORCE.CONNECT]');
        }
        catch (err) {
            logErrorResponse(err, '[JSFORCE.CONNECT]');
        }
    });
}
function sendTokens(tokens, instanceKey) {
    return __awaiter(this, void 0, void 0, function* () {
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
            .upsert(Object.assign({}, (yield addNamespace(newSetting, instanceKey))), `${orgNamespace}__Client_Id__c`);
    });
}
function setupNamespace(instanceKey) {
    return __awaiter(this, void 0, void 0, function* () {
        let connection;
        ({ connection } = InstanceManager.get(instanceKey, ['connection']));
        const jsForceRecords = yield connection.query('SELECT NamespacePrefix FROM ApexClass WHERE Name = \'CloudStorageService\' LIMIT 1');
        const orgNamespace = jsForceRecords.records[0].NamespacePrefix;
        InstanceManager.add(instanceKey, { orgNamespace });
        logSuccessResponse({ orgNamespace }, '[JSFORCE.SETUP_NAMESPACE]');
    });
}
function create(file, instanceKey) {
    return __awaiter(this, void 0, void 0, function* () {
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
            const sObject = yield connection
                .sobject(`${orgNamespace}__Document__c`)
                .create(Object.assign({ Name: name }, (yield addNamespace(newAttachment, instanceKey))));
            logSuccessResponse({ sObject }, '[JSFORCE.CREATE]');
            return Object.assign(Object.assign({}, sObject), { revisionId });
        }
        catch (err) {
            logErrorResponse({ err }, '[JSFORCE.CREATE]');
        }
    });
}
function addNamespace(customObject, instanceKey) {
    return __awaiter(this, void 0, void 0, function* () {
        let orgNamespace;
        ({ orgNamespace } = InstanceManager.get(instanceKey, ['orgNamespace']));
        for (const key in customObject) {
            Object.defineProperty(customObject, `${orgNamespace}__${key}`, Object.getOwnPropertyDescriptor(customObject, key));
            delete customObject[key];
        }
        return customObject;
    });
}
module.exports = {
    connect,
    create,
    sendTokens
};
