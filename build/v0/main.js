'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const app = express_1.default();
const server = require('http').createServer(app);
const port = process.env.PORT || 6000;
module.exports = server;
const Logger_1 = require("./utils/Logger");
const authRouter_1 = __importDefault(require("./routers/authRouter"));
const uploadRouter_1 = __importDefault(require("./routers/uploadRouter"));
app.use(express_1.default.json());
app.use(cors_1.default());
app.use(express_1.default.static(path_1.default.join(__dirname, '../../public')));
if (process.argv[2] == 'PRODUCTION') {
    server.listen(port, () => {
        try {
            Logger_1.logSuccessResponse('SUCCESS', '[SERVER_INIT]');
        }
        catch (err) {
            Logger_1.logErrorResponse(err, '[SERVER_INIT]');
        }
    });
}
app.use('/auth', authRouter_1.default);
app.use('/upload', uploadRouter_1.default);
app.get('/:instanceKey', (req, res) => {
    try {
        const instanceKey = req.params.instanceKey;
        Logger_1.logSuccessResponse(instanceKey, '[END_POINT.INSTANCE_KEY]');
        res.sendFile('index.html', { root: path_1.default.join(__dirname, '../../public/') });
    }
    catch (err) {
        Logger_1.logErrorResponse(err, '[END_POINT.INSTANCE_KEY]');
    }
});
