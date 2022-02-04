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
const qs_1 = __importDefault(require("qs"));
const axios_1 = __importDefault(require("axios"));
class AuthProvider {
    constructor(clientId, clientSecret, tenantId) {
        this.scope = 'https://graph.microsoft.com/.default offline_access';
        this.grantType = 'client_credentials';
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.tenantId = tenantId;
    }
    generateTokenEndpoint(tenantId) {
        if (tenantId == null)
            throw new Error('TenantId not passed into authenticator.');
        return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    }
    getAccessToken() {
        return __awaiter(this, void 0, void 0, function* () {
            const postData = {
                client_id: this.clientId,
                scope: this.scope,
                client_secret: this.clientSecret,
                grant_type: this.grantType
            };
            const options = {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                data: qs_1.default.stringify(postData),
                url: this.generateTokenEndpoint(this.tenantId)
            };
            const tokenRequestResponse = yield axios_1.default(options);
            return tokenRequestResponse.data.access_token;
        });
    }
}
exports.default = AuthProvider;
