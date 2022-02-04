"use strict";
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
exports.authorizeOAuth2Client = void 0;
const InstanceManager_1 = __importDefault(require("../InstanceManager"));
const Logger_1 = require("../Logger");
const authorizeOAuth2Client = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    let platform, salesforceUrl, clientId, clientSecret, destinationFolderId, tenantId, PLATFORM_CONFIG;
    if (process.argv[2] == 'PRODUCTION') {
        ({ platform, salesforceUrl, clientId, clientSecret, destinationFolderId, tenantId } = req.body);
        res.locals = Object.assign({}, req.body);
    }
    else {
        ({ salesforceUrl, PLATFORM_CONFIG } = process.env);
        ({ platform } = req.body);
        ({ clientId, clientSecret, destinationFolderId, tenantId } = JSON.parse(PLATFORM_CONFIG)[platform]);
        res.locals = Object.assign(Object.assign(Object.assign({}, res.locals), req.body), { platform, salesforceUrl, clientId, clientSecret, destinationFolderId, tenantId });
    }
    if (!InstanceManager_1.default.checkRegistration(salesforceUrl)) {
        InstanceManager_1.default.register(salesforceUrl);
        InstanceManager_1.default.upsert(salesforceUrl, { destinationFolderId, tenantId });
        yield Logger_1.getPlatform(platform).authorize(salesforceUrl, clientId, clientSecret, {});
    }
    next();
});
exports.authorizeOAuth2Client = authorizeOAuth2Client;
