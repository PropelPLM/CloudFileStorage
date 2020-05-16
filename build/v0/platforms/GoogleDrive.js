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
exports.GoogleDrive = void 0;
var google = require('googleapis').google;
var PassThrough = require('stream').PassThrough;
var _a = require('../utils/Logger'), logSuccessResponse = _a.logSuccessResponse, logErrorResponse = _a.logErrorResponse;
var MessageEmitter = require('../utils/MessageEmitter');
var InstanceManager = require('../utils/InstanceManager');
var GoogleDrive = (function () {
    function GoogleDrive() {
        this.redirect_uris = ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'];
        this.actions = { driveFiles: 'https://www.googleapis.com/auth/drive.file' };
    }
    ;
    GoogleDrive.prototype.createAuthUrl = function (credentials, instanceKey) {
        var clientId, clientSecret, redirect_uri;
        (clientId = credentials.clientId, clientSecret = credentials.clientSecret, redirect_uri = credentials.redirect_uri);
        var oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect_uri);
        InstanceManager.add(instanceKey, { oAuth2Client: oAuth2Client });
        return oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: this.actions.driveFiles,
            state: Buffer.from(instanceKey).toString('base64')
        });
    };
    GoogleDrive.prototype.getTokens = function (code, instanceKey) {
        return __awaiter(this, void 0, void 0, function () {
            var oAuth2Client;
            return __generator(this, function (_a) {
                (oAuth2Client = InstanceManager.get(instanceKey, ['oAuth2Client']).oAuth2Client);
                oAuth2Client.getToken(code)
                    .then(function (token) {
                    logSuccessResponse({}, '[GOOGLE_DRIVE.GET_TOKENS]');
                    return token;
                })
                    .catch(function (err) {
                    logErrorResponse({}, '[GOOGLE_DRIVE.GET_TOKENS]');
                    return err;
                });
                return [2];
            });
        });
    };
    GoogleDrive.prototype.authorize = function (instanceKey, clientId, clientSecret, tokens) {
        return __awaiter(this, void 0, void 0, function () {
            var oAuth2Client;
            return __generator(this, function (_a) {
                try {
                    oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, this.redirect_uris[0]);
                    oAuth2Client.setCredentials(tokens);
                    InstanceManager.add(instanceKey, { oAuth2Client: oAuth2Client });
                    logSuccessResponse({}, '[GOOGLE_DRIVE.AUTHORIZE]');
                }
                catch (err) {
                    logErrorResponse(err, '[GOOGLE_DRIVE.AUTHORIZE]');
                }
                return [2];
            });
        });
    };
    GoogleDrive.prototype.initUpload = function (instanceKey, _a) {
        var fileName = _a.fileName, mimeType = _a.mimeType, fileSize = _a.fileSize;
        return __awaiter(this, void 0, void 0, function () {
            var destinationFolderId, oAuth2Client, drive, uploadStream, fileMetadata, media, file;
            var _b;
            return __generator(this, function (_c) {
                (_b = InstanceManager.get(instanceKey, ['destinationFolderId', 'oAuth2Client']), destinationFolderId = _b.destinationFolderId, oAuth2Client = _b.oAuth2Client);
                drive = google.drive({ version: 'v3', auth: oAuth2Client });
                uploadStream = new PassThrough();
                fileMetadata = {
                    name: fileName,
                    driveId: destinationFolderId,
                    parents: [destinationFolderId]
                };
                media = {
                    mimeType: mimeType,
                    body: uploadStream
                };
                file = drive.files.create({
                    resource: fileMetadata,
                    media: media,
                    supportsAllDrives: true,
                    fields: 'id, name, webViewLink, mimeType, fileExtension, webContentLink'
                }, {
                    onUploadProgress: function (evt) {
                        var bytesRead = evt.bytesRead;
                        InstanceManager.update(instanceKey, 'externalBytes', bytesRead);
                        MessageEmitter.postProgress(instanceKey, 'Google Drive');
                        if (bytesRead == fileSize) {
                            uploadStream.emit('end');
                        }
                    }
                });
                InstanceManager.addRef(instanceKey, 'uploadStream', uploadStream);
                InstanceManager.addRef(instanceKey, 'file', file);
                return [2];
            });
        });
    };
    GoogleDrive.prototype.uploadFile = function (instanceKey, payload) {
        return __awaiter(this, void 0, void 0, function () {
            var uploadStream;
            return __generator(this, function (_a) {
                (uploadStream = InstanceManager.getRef(instanceKey, 'uploadStream').uploadStream);
                uploadStream.write(payload);
                InstanceManager.update(instanceKey, 'uploadStream', uploadStream);
                return [2];
            });
        });
    };
    GoogleDrive.prototype.endUpload = function (instanceKey) {
        return __awaiter(this, void 0, void 0, function () {
            var file;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (file = InstanceManager.getRef(instanceKey, 'file').file);
                        return [4, file];
                    case 1: return [2, _a.sent()];
                }
            });
        });
    };
    return GoogleDrive;
}());
exports.GoogleDrive = GoogleDrive;