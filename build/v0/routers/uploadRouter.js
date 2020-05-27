'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express = __importStar(require("express"));
const router = express.Router();
const Busboy = require('busboy');
const Logger_1 = require("../utils/Logger");
const InstanceManager_1 = __importDefault(require("../utils/InstanceManager"));
const MessageEmitter_1 = __importDefault(require("../utils/MessageEmitter"));
const JsForce_1 = __importDefault(require("../utils/JsForce"));
const GoogleDrive_1 = __importDefault(require("../platforms/GoogleDrive"));
router.post('/token/:instanceKey', async (req, res) => {
    const instanceKey = req.params.instanceKey;
    try {
        let client_secret, client_id, access_token, refresh_token, expiry_date, sessionId, salesforceUrl, tokensFromCredentials;
        ({ client_secret, client_id, access_token, refresh_token, expiry_date, sessionId, salesforceUrl } = req.body);
        tokensFromCredentials = {
            access_token,
            refresh_token,
            scope: GoogleDrive_1.default.actions.driveFiles,
            token_type: 'Bearer',
            expiry_date
        };
        InstanceManager_1.default.register(instanceKey);
        GoogleDrive_1.default.authorize(instanceKey, client_id, client_secret, tokensFromCredentials);
        const instanceDetails = { salesforceUrl };
        await Promise.all([
            InstanceManager_1.default.upsert(instanceKey, instanceDetails),
            JsForce_1.default.connect(sessionId, salesforceUrl, instanceKey)
        ]);
        Logger_1.logSuccessResponse({ ...tokensFromCredentials, instanceKey }, '[END_POINT.TOKEN]');
        res.status(200).send({ ...tokensFromCredentials, instanceKey });
    }
    catch (err) {
        Logger_1.logErrorResponse(err, '[END_POINT.TOKEN]');
        res.send(`Failed to receive tokens: ${err}`);
    }
});
router.post('/uploadDetails/:instanceKey', async (req, res) => {
    try {
        const instanceKey = req.params.instanceKey;
        let revisionId, destinationFolderId, isNew;
        ({ revisionId, destinationFolderId, isNew } = req.body);
        const instanceDetails = { revisionId, destinationFolderId, isNew };
        InstanceManager_1.default.upsert(instanceKey, instanceDetails);
        Logger_1.logSuccessResponse({ instanceKey }, '[END_POINT.UPLOAD_DETAILS]');
        res.status(200).send({ instanceKey });
    }
    catch (err) {
        Logger_1.logErrorResponse(err, '[END_POINT.UPLOAD_DETAILS]');
    }
});
router.post('/:instanceKey', async (req, res) => {
    const instanceKey = req.params.instanceKey;
    const form = new Busboy({ headers: req.headers });
    let salesforceUrl, isNew;
    ({ salesforceUrl, isNew } = InstanceManager_1.default.get(instanceKey, ["salesforceUrl", "isNew"]));
    try {
        let fileSize;
        form
            .on('field', (fieldName, value) => {
            fileSize = fieldName == 'fileSize' ? value : 0;
        })
            .on('file', async function (_1, file, fileName, _2, mimeType) {
            await Promise.all([
                GoogleDrive_1.default.initUpload(instanceKey, { fileName, mimeType, fileSize }),
                InstanceManager_1.default.upsert(instanceKey, { fileName, frontendBytes: 0, externalBytes: 0, fileSize })
            ]);
            let progress = 0;
            file
                .on('data', async (data) => {
                progress = progress + data.length;
                InstanceManager_1.default.upsert(instanceKey, { frontendBytes: progress });
                MessageEmitter_1.default.postProgress(instanceKey, 'FRONTEND');
                await GoogleDrive_1.default.uploadFile(instanceKey, data);
            })
                .on('error', err => {
                Logger_1.logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > BUSBOY]');
            });
        })
            .on('finish', async () => {
            const file = await GoogleDrive_1.default.endUpload(instanceKey);
            const sfObject = await JsForce_1.default.create(file.data, instanceKey);
            const response = {
                status: parseInt(file.status),
                data: {
                    ...file.data,
                    sfId: sfObject.id,
                    revisionId: sfObject.revisionId,
                    salesforceUrl,
                    isNew
                }
            };
            res.status(response.status).send(response.data);
            Logger_1.logSuccessResponse(response, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
        });
        req.pipe(form);
    }
    catch (err) {
        Logger_1.logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
    }
});
exports.default = router;
