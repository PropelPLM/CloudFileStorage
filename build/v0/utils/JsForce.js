'use strict';
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsForce = void 0;
var jsforce_1 = __importDefault(require("jsforce"));
var Logger_1 = require("../utils/Logger");
var InstanceManager_1 = __importDefault(require("../utils/InstanceManager"));
var MessageEmitter_1 = __importDefault(require("../utils/MessageEmitter"));
var JsForce = (function () {
    function JsForce() {
    }
    JsForce.prototype.connect = function (sessionId, salesforceUrl, instanceKey) {
        return __awaiter(this, void 0, void 0, function () {
            var connection, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        connection = new jsforce_1.default.Connection({
                            instanceUrl: salesforceUrl,
                            sessionId: sessionId
                        });
                        return [4, Promise.all([
                                InstanceManager_1.default.upsert(instanceKey, { connection: connection }),
                                this.setupNamespace(instanceKey)
                            ])];
                    case 1:
                        _a.sent();
                        Logger_1.logSuccessResponse({}, '[JSFORCE.CONNECT]');
                        return [3, 3];
                    case 2:
                        err_1 = _a.sent();
                        Logger_1.logErrorResponse(err_1, '[JSFORCE.CONNECT]');
                        return [3, 3];
                    case 3: return [2];
                }
            });
        });
    };
    JsForce.prototype.sendTokens = function (tokens, instanceKey) {
        return __awaiter(this, void 0, void 0, function () {
            var newSetting, connection, orgNamespace, upsertedTokens, _a, _b, _c, err_2;
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        newSetting = {
                            Access_Token__c: tokens.access_token,
                            Refresh_Token__c: tokens.refresh_token,
                            Expiry_Date__c: tokens.expiry_date,
                            Client_Id__c: tokens.clientId,
                            Client_Secret__c: tokens.clientSecret
                        };
                        (_d = InstanceManager_1.default.get(instanceKey, ["connection", "orgNamespace"]), connection = _d.connection, orgNamespace = _d.orgNamespace);
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 4, , 5]);
                        _b = (_a = connection
                            .sobject(orgNamespace + "__Cloud_Storage__c")).upsert;
                        _c = [{}];
                        return [4, this.addNamespace(newSetting, instanceKey)];
                    case 2: return [4, _b.apply(_a, [__assign.apply(void 0, _c.concat([(_e.sent())])), orgNamespace + "__Client_Id__c"])];
                    case 3:
                        upsertedTokens = _e.sent();
                        Logger_1.logSuccessResponse(upsertedTokens, '[JSFORCE.SEND_TOKENS]');
                        MessageEmitter_1.default.postTrigger(instanceKey, 'authComplete', {});
                        return [3, 5];
                    case 4:
                        err_2 = _e.sent();
                        Logger_1.logSuccessResponse(err_2, '[JSFORCE.SEND_TOKENS]');
                        return [3, 5];
                    case 5: return [2];
                }
            });
        });
    };
    JsForce.prototype.create = function (file, instanceKey) {
        return __awaiter(this, void 0, void 0, function () {
            var connection, orgNamespace, revisionId, isNew, name_1, webViewLink, id, fileExtension, webContentLink, newAttachment, sObject, _a, _b, _c, err_3;
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _e.trys.push([0, 3, , 4]);
                        connection = void 0, orgNamespace = void 0, revisionId = void 0, isNew = void 0, webViewLink = void 0, id = void 0, fileExtension = void 0, webContentLink = void 0;
                        (_d = InstanceManager_1.default.get(instanceKey, ["connection", "orgNamespace", "revisionId", "isNew"]), connection = _d.connection, orgNamespace = _d.orgNamespace, revisionId = _d.revisionId, isNew = _d.isNew);
                        console.log('orgNamespace', orgNamespace);
                        console.log('revisionId', revisionId);
                        console.log('isNew', isNew);
                        console.log('connection', connection);
                        (name_1 = file.name, webViewLink = file.webViewLink, id = file.id, fileExtension = file.fileExtension, webContentLink = file.webContentLink);
                        console.log('name', name_1);
                        console.log('webViewLink', webViewLink);
                        console.log('id', id);
                        console.log('fileExtension', fileExtension);
                        console.log('webContentLink', webContentLink);
                        newAttachment = {
                            External_Attachment_URL__c: webViewLink,
                            File_Extension__c: fileExtension,
                            Google_File_Id__c: id,
                            External_Attachment_Download_URL__c: webContentLink,
                            Content_Location__c: 'E'
                        };
                        if (!isNew) {
                            newAttachment['Item_Revision__c'] = revisionId;
                        }
                        _b = (_a = connection
                            .sobject(orgNamespace + "__Document__c")).create;
                        _c = [{ Name: name_1 }];
                        return [4, this.addNamespace(newAttachment, instanceKey)];
                    case 1: return [4, _b.apply(_a, [__assign.apply(void 0, _c.concat([(_e.sent())]))])];
                    case 2:
                        sObject = _e.sent();
                        Logger_1.logSuccessResponse({ sObject: sObject }, '[JSFORCE.CREATE]');
                        return [2, __assign(__assign({}, sObject), { revisionId: revisionId })];
                    case 3:
                        err_3 = _e.sent();
                        Logger_1.logErrorResponse({ err: err_3 }, '[JSFORCE.CREATE]');
                        return [3, 4];
                    case 4: return [2];
                }
            });
        });
    };
    JsForce.prototype.setupNamespace = function (instanceKey) {
        return __awaiter(this, void 0, void 0, function () {
            var connection, jsForceRecords, orgNamespace;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (connection = InstanceManager_1.default.get(instanceKey, ["connection"]).connection);
                        return [4, connection.query('SELECT NamespacePrefix FROM ApexClass WHERE Name = \'CloudStorageService\' LIMIT 1')];
                    case 1:
                        jsForceRecords = _a.sent();
                        orgNamespace = jsForceRecords.records[0].NamespacePrefix;
                        InstanceManager_1.default.upsert(instanceKey, { orgNamespace: orgNamespace });
                        Logger_1.logSuccessResponse({ orgNamespace: orgNamespace }, '[JSFORCE.SETUP_NAMESPACE]');
                        return [2];
                }
            });
        });
    };
    JsForce.prototype.addNamespace = function (customObject, instanceKey) {
        return __awaiter(this, void 0, void 0, function () {
            var orgNamespace, key;
            return __generator(this, function (_a) {
                (orgNamespace = InstanceManager_1.default.get(instanceKey, ["orgNamespace"]).orgNamespace);
                for (key in customObject) {
                    Object.defineProperty(customObject, orgNamespace + "__" + key, Object.getOwnPropertyDescriptor(customObject, key));
                    delete customObject[key];
                }
                return [2, customObject];
            });
        });
    };
    return JsForce;
}());
exports.JsForce = JsForce;
exports.default = new JsForce();
