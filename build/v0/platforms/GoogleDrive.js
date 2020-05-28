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
const { google } = require('googleapis');
const stream_1 = require("stream");
const Logger_1 = require("../utils/Logger");
const MessageEmitter_1 = __importDefault(require("../utils/MessageEmitter"));
const InstanceManager_1 = __importDefault(require("../utils/InstanceManager"));
class GoogleDrive {
    constructor() {
        this.redirect_uris = ['urn:ietf:wg:oauth:2.0:oob', 'http://localhost'];
        this.actions = { driveFiles: 'https://www.googleapis.com/auth/drive.file' };
    }
    createAuthUrl(credentials, instanceKey) {
        let clientId, clientSecret, redirect_uri;
        ({ clientId, clientSecret, redirect_uri } = credentials);
        const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect_uri);
        InstanceManager_1.default.upsert(instanceKey, { oAuth2Client });
        return oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: this.actions.driveFiles,
            state: Buffer.from(instanceKey).toString('base64')
        });
    }
    getTokens(code, instanceKey) {
        let oAuth2Client;
        try {
            ({ oAuth2Client } = InstanceManager_1.default.get(instanceKey, ["oAuth2Client"]));
            const token = oAuth2Client.getToken(code);
            Logger_1.logSuccessResponse({}, '[GOOGLE_DRIVE.GET_TOKENS]');
            return token;
        }
        catch (err) {
            Logger_1.logErrorResponse(err, '[GOOGLE_DRIVE.GET_TOKENS]');
            return {};
        }
    }
    authorize(instanceKey, clientId, clientSecret, tokens) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, this.redirect_uris[0]);
                oAuth2Client.setCredentials(tokens);
                InstanceManager_1.default.upsert(instanceKey, { oAuth2Client });
                Logger_1.logSuccessResponse({}, '[GOOGLE_DRIVE.AUTHORIZE]');
            }
            catch (err) {
                Logger_1.logErrorResponse(err, '[GOOGLE_DRIVE.AUTHORIZE]');
                throw (err);
            }
        });
    }
    initUpload(instanceKey, { fileName, mimeType, fileSize }) {
        return __awaiter(this, void 0, void 0, function* () {
            let destinationFolderId, oAuth2Client;
            ({ destinationFolderId, oAuth2Client } = InstanceManager_1.default.get(instanceKey, ["destinationFolderId", "oAuth2Client"]));
            const drive = google.drive({ version: 'v3', auth: oAuth2Client });
            const uploadStream = new stream_1.PassThrough();
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
                    InstanceManager_1.default.upsert(instanceKey, { externalBytes: bytesRead });
                    MessageEmitter_1.default.postProgress(instanceKey, 'GOOGLE_DRIVE');
                    if (bytesRead == fileSize) {
                        uploadStream.emit('end');
                    }
                }
            });
            InstanceManager_1.default.upsert(instanceKey, { uploadStream, file });
        });
    }
    uploadFile(instanceKey, payload) {
        return __awaiter(this, void 0, void 0, function* () {
            let uploadStream;
            ({ uploadStream } = InstanceManager_1.default.get(instanceKey, ["uploadStream"]));
            try {
                uploadStream.push(payload);
                InstanceManager_1.default.upsert(instanceKey, { uploadStream });
            }
            catch (err) {
                Logger_1.logErrorResponse(err, '[GOOGLE_DRIVE > UPLOAD_FILE]');
            }
        });
    }
    endUpload(instanceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            let file;
            ({ file } = InstanceManager_1.default.get(instanceKey, ["file"]));
            return yield file;
        });
    }
}
exports.default = new GoogleDrive();
