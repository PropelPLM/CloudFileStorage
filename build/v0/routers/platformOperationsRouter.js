'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const authorizeOAuth2Client_1 = require("../utils/middleware/authorizeOAuth2Client");
const fileRouter_1 = __importDefault(require("./fileRouter"));
const permissionRouter_1 = __importDefault(require("./permissionRouter"));
router.use('/', authorizeOAuth2Client_1.authorizeOAuth2Client);
router.use('/files', fileRouter_1.default);
router.use('/permissions', permissionRouter_1.default);
exports.default = router;
