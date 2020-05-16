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
var express_1 = __importDefault(require("express"));
var router = express_1.default.Router();
var Logger_1 = require("../utils/Logger");
var InstanceManager_1 = __importDefault(require("../utils/InstanceManager"));
var MessageEmitter_1 = __importDefault(require("../utils/MessageEmitter"));
var GoogleDrive_1 = __importDefault(require("../platforms/GoogleDrive"));
var JsForce_1 = __importDefault(require("../utils/JsForce"));
router.post('/:instanceKey', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var instanceKey, sessionId, salesforceUrl, clientId, clientSecret, instanceDetails, credentials, url;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                instanceKey = req.params.instanceKey;
                (_a = req.body, sessionId = _a.sessionId, salesforceUrl = _a.salesforceUrl, clientId = _a.clientId, clientSecret = _a.clientSecret);
                InstanceManager_1.default.register(instanceKey);
                instanceDetails = { salesforceUrl: salesforceUrl, clientId: clientId, clientSecret: clientSecret };
                return [4, Promise.all([
                        InstanceManager_1.default.add(instanceKey, instanceDetails),
                        JsForce_1.default.connect(sessionId, salesforceUrl, instanceKey)
                    ])];
            case 1:
                _b.sent();
                if (clientId && clientSecret) {
                    credentials = { clientId: clientId, clientSecret: clientSecret, redirect_uri: "https://" + req.hostname + "/auth/callback/google" };
                    url = GoogleDrive_1.default.createAuthUrl(credentials, instanceKey);
                    MessageEmitter_1.default.setAttribute(instanceKey, 'target-window', salesforceUrl);
                    Logger_1.logSuccessResponse(instanceKey, '[END_POINT.AUTH_REDIRECT]');
                    res.status(200).send({ url: url });
                }
                else {
                    Logger_1.logErrorResponse({ clientId: clientId, clientSecret: clientSecret }, '[END_POINT.AUTH_REDIRECT]');
                    res.status(400).send('Authorization failed, please ensure client credentials are populated.');
                }
                return [2];
        }
    });
}); });
router.get('/callback/google', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var instanceKey, code, token, clientId, clientSecret;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                instanceKey = Buffer.from(req.query.state, 'base64').toString();
                code = req.query.code;
                return [4, GoogleDrive_1.default.getTokens(code, instanceKey)];
            case 1:
                token = _b.sent();
                console.log('token received: ', token);
                (_a = InstanceManager_1.default.get(instanceKey, ['clientId', 'clientSecret']), clientId = _a.clientId, clientSecret = _a.clientSecret);
                return [4, JsForce_1.default.sendTokens(__assign(__assign({}, token), { clientId: clientId, clientSecret: clientSecret }), instanceKey)];
            case 2:
                _b.sent();
                res.send('<script>window.close()</script>');
                return [2];
        }
    });
}); });
module.exports = router;
