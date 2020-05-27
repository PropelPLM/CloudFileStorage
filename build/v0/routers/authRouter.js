'use strict';
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
router.post('/:instanceKey', async (req, res) => {
    const instanceKey = req.params.instanceKey;
    let sessionId, salesforceUrl, clientId, clientSecret;
    ({ sessionId, salesforceUrl, clientId, clientSecret } = req.body);
    InstanceManager_1.default.register(instanceKey);
    const instanceDetails = { salesforceUrl, clientId, clientSecret };
    await Promise.all([
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
        Logger_1.logErrorResponse({ clientId, clientSecret }, '[END_POINT.AUTH_REDIRECT]');
        res.status(400).send('Authorization failed, please ensure client credentials are populated.');
    }
});
router.get('/callback/google', async (req, res) => {
    const instanceKey = Buffer.from(req.query.state, 'base64').toString();
    const code = req.query.code;
    try {
        const token = await GoogleDrive_1.default.getTokens(code, instanceKey);
        let clientId, clientSecret;
        ({ clientId, clientSecret } = InstanceManager_1.default.get(instanceKey, ["clientId", "clientSecret"]));
        await JsForce_1.default.sendTokens({ ...token.tokens, clientId, clientSecret }, instanceKey);
        MessageEmitter_1.default.postTrigger(instanceKey, 'authComplete', {});
        Logger_1.logSuccessResponse('MessageEmitted', '[CALLBACK_GOOGLE');
        res.send('<script>window.close()</script>');
    }
    catch (err) {
        Logger_1.logErrorResponse(err, '[CALLBACK_GOOGLE');
    }
});
exports.default = router;
