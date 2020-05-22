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
exports.GoogleDrive = void 0;
const { google } = require('googleapis');
const { PassThrough } = require('stream');
const { logSuccessResponse, logErrorResponse } = require('./Logger');
const MessageEmitter = require('./MessageEmitter');
const InstanceManager = require('./InstanceManager');
const JsForce = require('./JsForce');
class GoogleDrive {
    constructor() {
        this.redirect_uris = ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'];
        this.actions = { driveFiles: 'https://www.googleapis.com/auth/drive.file' };
    }
    ;
    createAuthUrl(credentials, instanceKey) {
        let clientId, clientSecret, redirect_uri;
        ({ clientId, clientSecret, redirect_uri } = credentials);
        const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect_uri);
        InstanceManager.add(instanceKey, { oAuth2Client });
        return oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: this.actions.driveFiles,
            state: Buffer.from(instanceKey).toString('base64')
        });
    }
    getTokens(code, instanceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            let clientId, clientSecret, oAuth2Client;
            ({ clientId, clientSecret, oAuth2Client } = InstanceManager.get(instanceKey, ['clientId', 'clientSecret', 'oAuth2Client']));
            oAuth2Client.getToken(code, (err, token) => {
                JsForce.sendTokens(Object.assign(Object.assign({}, token), { clientId, clientSecret }), instanceKey);
            });
            logSuccessResponse({}, '[GOOGLE_DRIVE.GET_TOKENS]');
            MessageEmitter.postTrigger(instanceKey, 'authComplete', {});
        });
    }
    authorize(instanceKey, clientId, clientSecret, tokens) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, this.redirect_uris[0]);
                oAuth2Client.setCredentials(tokens);
                InstanceManager.add(instanceKey, { oAuth2Client });
                logSuccessResponse({}, '[GOOGLE_DRIVE.AUTHORIZE]');
            }
            catch (err) {
                logErrorResponse(err, '[GOOGLE_DRIVE.AUTHORIZE]');
            }
        });
    }
    initUpload(instanceKey, { fileName, mimeType, fileSize }) {
        return __awaiter(this, void 0, void 0, function* () {
            let destinationFolderId, oAuth2Client;
            ({ destinationFolderId, oAuth2Client } = InstanceManager.get(instanceKey, ['destinationFolderId', 'oAuth2Client']));
            const drive = google.drive({ version: 'v3', auth: oAuth2Client });
            const uploadStream = new PassThrough();
            const fileMetadata = {
                name: fileName,
                driveId: destinationFolderId,
                parents: [destinationFolderId]
            };
            var media = {
                mimeType: mimeType,
                body: uploadStream
            };
            const file = drive.files.create({
                resource: fileMetadata,
                media,
                supportsAllDrives: true,
                fields: 'id, name, webViewLink, mimeType, fileExtension, webContentLink'
            }, {
                onUploadProgress: (evt) => {
                    const bytesRead = evt.bytesRead;
                    InstanceManager.update(instanceKey, 'externalBytes', bytesRead);
                    MessageEmitter.postProgress(instanceKey, 'Google Drive');
                    if (bytesRead == fileSize) {
                        uploadStream.emit('end');
                    }
                }
            });
            InstanceManager.addRef(instanceKey, 'uploadStream', uploadStream);
            InstanceManager.addRef(instanceKey, 'file', file);
        });
    }
    uploadFile(instanceKey, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            let uploadStream;
            ({ uploadStream } = InstanceManager.getRef(instanceKey, 'uploadStream'));
            uploadStream.write(payload);
            InstanceManager.update(instanceKey, 'uploadStream', uploadStream);
        });
    }
    endUpload(instanceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            let file;
            ({ file } = InstanceManager.getRef(instanceKey, 'file'));
            return yield file;
        });
    }
}
exports.GoogleDrive = GoogleDrive;
