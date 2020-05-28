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
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const path_1 = __importDefault(require("path"));
const Logger_1 = require("../utils/Logger");
const InstanceManager_1 = __importDefault(require("../utils/InstanceManager"));
const MessageEmitter_1 = __importDefault(require("../utils/MessageEmitter"));
const GoogleDrive_1 = __importDefault(require("../platforms/GoogleDrive"));
const JsForce_1 = __importDefault(require("../utils/JsForce"));
router.get('/:instanceKey', (req, res) => {
    InstanceManager_1.default.register(req.params.instanceKey);
    res.sendFile('index.html', { root: path_1.default.join(__dirname, '../../../public/') });
});
router.post('/:instanceKey', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const instanceKey = req.params.instanceKey;
    let sessionId, salesforceUrl, clientId, clientSecret;
    ({ sessionId, salesforceUrl, clientId, clientSecret } = req.body);
    InstanceManager_1.default.register(instanceKey);
    const instanceDetails = { salesforceUrl, clientId, clientSecret };
    try {
        yield Promise.all([
            InstanceManager_1.default.upsert(instanceKey, instanceDetails),
            JsForce_1.default.connect(sessionId, salesforceUrl, instanceKey)
        ]);
        if (clientId && clientSecret) {
            const credentials = { clientId, clientSecret, redirect_uri: `https://${req.hostname}/auth/callback/google` };
            const url = GoogleDrive_1.default.createAuthUrl(credentials, instanceKey);
            MessageEmitter_1.default.setAttribute(instanceKey, 'target-window', salesforceUrl);
            Logger_1.logSuccessResponse(instanceKey, '[END_POINT.AUTH_REDIRECT]');
            res.status(200).send({ url });
        }
        else {
            throw new Error('Client Id or secret is missing.');
        }
    }
    catch (err) {
        Logger_1.logErrorResponse(err, '[END_POINT.AUTH_REDIRECT]');
        res.status(400).send(`Authorization failed, please check your credentials: ${err}`);
    }
}));
router.get('/callback/google', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const instanceKey = Buffer.from(req.query.state, 'base64').toString();
    const code = req.query.code;
    try {
        const token = yield GoogleDrive_1.default.getTokens(code, instanceKey);
        let clientId, clientSecret;
        ({ clientId, clientSecret } = InstanceManager_1.default.get(instanceKey, ["clientId", "clientSecret"]));
        if (token.tokens) {
            yield JsForce_1.default.sendTokens(Object.assign(Object.assign({}, token.tokens), { clientId, clientSecret }), instanceKey);
        }
        else {
            throw new Error('No tokens found in Google Drive callback.');
        }
        MessageEmitter_1.default.postTrigger(instanceKey, 'authComplete', {});
        Logger_1.logSuccessResponse('MessageEmitted', '[CALLBACK_GOOGLE');
        res.send('<script>window.close()</script>');
    }
    catch (err) {
        res.status(500).send(`Callback from google has failed: ${err}`);
        Logger_1.logErrorResponse(err, '[CALLBACK_GOOGLE');
    }
}));
exports.default = router;
