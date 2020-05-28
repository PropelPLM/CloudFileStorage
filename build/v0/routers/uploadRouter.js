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
const express = __importStar(require("express"));
const router = express.Router();
const Busboy = require('busboy');
const Logger_1 = require("../utils/Logger");
const InstanceManager_1 = __importDefault(require("../utils/InstanceManager"));
const MessageEmitter_1 = __importDefault(require("../utils/MessageEmitter"));
const JsForce_1 = __importDefault(require("../utils/JsForce"));
const GoogleDrive_1 = __importDefault(require("../platforms/GoogleDrive"));
router.post('/token/:instanceKey', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const instanceKey = req.params.instanceKey;
    try {
        let client_secret, client_id, access_token, refresh_token, expiry_date, sessionId, salesforceUrl;
        ({ client_secret, client_id, access_token, refresh_token, expiry_date, sessionId, salesforceUrl } = req.body);
        const tokensFromCredentials = {
            access_token,
            refresh_token,
            scope: GoogleDrive_1.default.actions.driveFiles,
            token_type: 'Bearer',
            expiry_date
        };
        InstanceManager_1.default.register(instanceKey);
        GoogleDrive_1.default.authorize(instanceKey, client_id, client_secret, tokensFromCredentials);
        const instanceDetails = { salesforceUrl };
        yield Promise.all([
            InstanceManager_1.default.upsert(instanceKey, instanceDetails),
            JsForce_1.default.connect(sessionId, salesforceUrl, instanceKey)
        ]);
        Logger_1.logSuccessResponse(Object.assign(Object.assign({}, tokensFromCredentials), { instanceKey }), '[END_POINT.TOKEN]');
        res.status(200).send(Object.assign(Object.assign({}, tokensFromCredentials), { instanceKey }));
    }
    catch (err) {
        Logger_1.logErrorResponse(err, '[END_POINT.TOKEN]');
        res.status(400).send(`Failed to receive tokens: ${err}`);
    }
}));
router.post('/uploadDetails/:instanceKey', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
        res.status(400).send(`Failed to update upload details ${err}`);
        Logger_1.logErrorResponse(err, '[END_POINT.UPLOAD_DETAILS]');
    }
}));
router.post('/:instanceKey', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            .on('file', function (_1, file, fileName, _2, mimeType) {
            return __awaiter(this, void 0, void 0, function* () {
                yield Promise.all([
                    GoogleDrive_1.default.initUpload(instanceKey, { fileName, mimeType, fileSize }),
                    InstanceManager_1.default.upsert(instanceKey, { fileName, frontendBytes: 0, externalBytes: 0, fileSize })
                ]);
                let progress = 0;
                file
                    .on('data', (data) => __awaiter(this, void 0, void 0, function* () {
                    progress = progress + data.length;
                    InstanceManager_1.default.upsert(instanceKey, { frontendBytes: progress });
                    MessageEmitter_1.default.postProgress(instanceKey, 'FRONTEND');
                    yield GoogleDrive_1.default.uploadFile(instanceKey, data);
                }))
                    .on('error', err => {
                    Logger_1.logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > BUSBOY]');
                });
            });
        })
            .on('finish', () => __awaiter(void 0, void 0, void 0, function* () {
            const file = yield GoogleDrive_1.default.endUpload(instanceKey);
            const sfObject = yield JsForce_1.default.create(file.data, instanceKey);
            const response = {
                status: parseInt(file.status),
                data: Object.assign(Object.assign({}, file.data), { sfId: sfObject.id, revisionId: sfObject.revisionId, salesforceUrl,
                    isNew })
            };
            res.status(response.status).send(response.data);
            Logger_1.logSuccessResponse(response, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
        }));
        req.pipe(form);
    }
    catch (err) {
        res.status(500).send(`Upload failed: ${err}`);
        Logger_1.logErrorResponse(err, '[END_POINT.UPLOAD_INSTANCE_KEY > UPLOAD]');
    }
}));
exports.default = router;
