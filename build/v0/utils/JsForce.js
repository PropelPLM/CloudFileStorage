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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsForce = void 0;
const jsforce_1 = __importDefault(require("jsforce"));
const Logger_1 = require("../utils/Logger");
const InstanceManager_1 = __importDefault(require("../utils/InstanceManager"));
const MessageEmitter_1 = __importDefault(require("../utils/MessageEmitter"));
class JsForce {
    constructor() { }
    connect(sessionId, salesforceUrl, instanceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const connection = new jsforce_1.default.Connection({
                    instanceUrl: salesforceUrl,
                    sessionId
                });
                yield Promise.all([
                    InstanceManager_1.default.upsert(instanceKey, { connection }),
                    this.setupNamespace(instanceKey)
                ]);
                Logger_1.logSuccessResponse({}, '[JSFORCE.CONNECT]');
            }
            catch (err) {
                Logger_1.logErrorResponse(err, '[JSFORCE.CONNECT]');
            }
        });
    }
    sendTokens(tokens, instanceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            const newSetting = {
                Access_Token__c: tokens.access_token,
                Refresh_Token__c: tokens.refresh_token,
                Expiry_Date__c: tokens.expiry_date,
                Client_Id__c: tokens.clientId,
                Client_Secret__c: tokens.clientSecret
            };
            let connection, orgNamespace;
            ({ connection, orgNamespace } = InstanceManager_1.default.get(instanceKey, ["connection", "orgNamespace"]));
            try {
                const upsertedTokens = yield connection
                    .sobject(`${orgNamespace}__Cloud_Storage__c`)
                    .upsert(Object.assign({}, (yield this.addNamespace(newSetting, instanceKey))), `${orgNamespace}__Client_Id__c`);
                Logger_1.logSuccessResponse(upsertedTokens, '[JSFORCE.SEND_TOKENS]');
                MessageEmitter_1.default.postTrigger(instanceKey, 'authComplete', {});
            }
            catch (err) {
                Logger_1.logSuccessResponse(err, '[JSFORCE.SEND_TOKENS]');
            }
        });
    }
    create(file, instanceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let connection, orgNamespace, revisionId, isNew, name, webViewLink, id, fileExtension, webContentLink;
                ({ connection, orgNamespace, revisionId, isNew } = InstanceManager_1.default.get(instanceKey, ["connection", "orgNamespace", "revisionId", "isNew"]));
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
                    .create(Object.assign({ Name: name }, (yield this.addNamespace(newAttachment, instanceKey))));
                Logger_1.logSuccessResponse({ sObject }, '[JSFORCE.CREATE]');
                return Object.assign(Object.assign({}, sObject), { revisionId });
            }
            catch (err) {
                Logger_1.logErrorResponse({ err }, '[JSFORCE.CREATE]');
            }
        });
    }
    setupNamespace(instanceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            let connection;
            ({ connection } = InstanceManager_1.default.get(instanceKey, ["connection"]));
            const jsForceRecords = yield connection.query('SELECT NamespacePrefix FROM ApexClass WHERE Name = \'CloudStorageService\' LIMIT 1');
            const orgNamespace = jsForceRecords.records[0].NamespacePrefix;
            InstanceManager_1.default.upsert(instanceKey, { orgNamespace });
            Logger_1.logSuccessResponse({ orgNamespace }, '[JSFORCE.SETUP_NAMESPACE]');
        });
    }
    addNamespace(customObject, instanceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            let orgNamespace;
            ({ orgNamespace } = InstanceManager_1.default.get(instanceKey, ["orgNamespace"]));
            for (const key in customObject) {
                Object.defineProperty(customObject, `${orgNamespace}__${key}`, Object.getOwnPropertyDescriptor(customObject, key));
                delete customObject[key];
            }
            return customObject;
        });
    }
}
exports.JsForce = JsForce;
exports.default = new JsForce();
