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
Object.defineProperty(exports, "__esModule", { value: true });
var express = require('express');
var router = express.Router();
var Busboy = require('busboy');
var _a = require('../utils/Logger'), logSuccessResponse = _a.logSuccessResponse, logErrorResponse = _a.logErrorResponse;
var InstanceManager = require('../utils/InstanceManager');
var MessageEmitter = require('../utils/MessageEmitter');
var GoogleDrive = require('../platforms/GoogleDrive');
var JsForce = require('../utils/JsForce');
router.post('/token/:instanceKey', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var instanceKey, client_secret, client_id, access_token, refresh_token, expiry_date, sessionId, salesforceUrl, tokensFromCredentials, instanceDetails, err_1;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                instanceKey = req.params.instanceKey;
                _b.label = 1;
            case 1:
                _b.trys.push([1, 3, , 4]);
                client_secret = void 0, client_id = void 0, access_token = void 0, refresh_token = void 0, expiry_date = void 0, sessionId = void 0, salesforceUrl = void 0, tokensFromCredentials = void 0;
                (_a = req.body, client_secret = _a.client_secret, client_id = _a.client_id, access_token = _a.access_token, refresh_token = _a.refresh_token, expiry_date = _a.expiry_date, sessionId = _a.sessionId, salesforceUrl = _a.salesforceUrl);
                tokensFromCredentials = {
                    access_token: access_token,
                    refresh_token: refresh_token,
                    scope: GoogleDrive.actions.driveFiles,
                    token_type: 'Bearer',
                    expiry_date: expiry_date
                };
                InstanceManager.register(instanceKey);
                GoogleDrive.authorize(instanceKey, client_id, client_secret, tokensFromCredentials);
                instanceDetails = { sessionId: sessionId, salesforceUrl: salesforceUrl };
                return [4, Promise.all([
                        InstanceManager.add(instanceKey, instanceDetails),
                        JsForce.connect(sessionId, salesforceUrl, instanceKey)
                    ])];
            case 2:
                _b.sent();
                logSuccessResponse(__assign(__assign({}, tokensFromCredentials), { instanceKey: instanceKey }), '[END_POINT.TOKEN]');
                res.status(200).send(__assign(__assign({}, tokensFromCredentials), { instanceKey: instanceKey }));
                return [3, 4];
            case 3:
                err_1 = _b.sent();
                logErrorResponse(err_1, '[END_POINT.TOKEN]');
                res.send("Failed to receive tokens: " + err_1);
                return [3, 4];
            case 4: return [2];
        }
    });
}); });
router.post('/uploadDetails/:instanceKey', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var instanceKey, revisionId, destinationFolderId, isNew, instanceDetails;
    var _a;
    return __generator(this, function (_b) {
        instanceKey = req.params.instanceKey;
        (_a = req.body, revisionId = _a.revisionId, destinationFolderId = _a.destinationFolderId, isNew = _a.isNew);
        instanceDetails = { revisionId: revisionId, destinationFolderId: destinationFolderId, isNew: isNew };
        InstanceManager.add(instanceKey, instanceDetails);
        logSuccessResponse({ instanceKey: instanceKey }, '[END_POINT.UPLOAD_DETAILS]');
        res.status(200).send({ instanceKey: instanceKey });
        return [2];
    });
}); });
router.post('/:instanceKey', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var instanceKey, form, salesforceUrl, isNew, fileSize_1;
    var _a;
    return __generator(this, function (_b) {
        instanceKey = req.params.instanceKey;
        form = new Busboy({ headers: req.headers });
        (_a = InstanceManager.get(instanceKey, ['salesforceUrl', 'isNew']), salesforceUrl = _a.salesforceUrl, isNew = _a.isNew);
        try {
            form
                .on('field', function (fieldName, value) {
                fileSize_1 = fieldName == 'fileSize' ? value : 0;
                console.log('fileSize', fileSize_1);
            })
                .on('file', function (_1, file, fileName, _2, mimeType) {
                return __awaiter(this, void 0, void 0, function () {
                    var progress;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4, Promise.all([
                                    GoogleDrive.initUpload(instanceKey, { fileName: fileName, mimeType: mimeType, fileSize: fileSize_1 }),
                                    InstanceManager.add(instanceKey, { frontendBytes: 0, externalBytes: 0, fileSize: fileSize_1 })
                                ])];
                            case 1:
                                _a.sent();
                                progress = 0;
                                file
                                    .on('data', function (data) {
                                    progress = progress + data.length;
                                    InstanceManager.update(instanceKey, 'frontendBytes', progress);
                                    MessageEmitter.postProgress(instanceKey, 'frontend');
                                    GoogleDrive.uploadFile(instanceKey, data);
                                })
                                    .on('error', function (error) {
                                    logErrorResponse(error, '[END_POINT.UPLOAD_INSTANCE_KEY > BUSBOY]');
                                });
                                return [2];
                        }
                    });
                });
            })
                .on('finish', function () { return __awaiter(void 0, void 0, void 0, function () {
                var file, sfObject, response;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4, GoogleDrive.endUpload(instanceKey)];
                        case 1:
                            file = _a.sent();
                            return [4, JsForce.create(file.data, instanceKey)];
                        case 2:
                            sfObject = _a.sent();
                            response = {
                                status: parseInt(file.status),
                                data: __assign(__assign({}, file.data), { sfId: sfObject.id, revisionId: sfObject.revisionId, salesforceUrl: salesforceUrl,
                                    isNew: isNew })
                            };
                            res.status(response.status).send(response.data);
                            logSuccessResponse(response, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
                            return [2];
                    }
                });
            }); });
            req.pipe(form);
        }
        catch (err) {
            logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
        }
        return [2];
    });
}); });
module.exports = router;
