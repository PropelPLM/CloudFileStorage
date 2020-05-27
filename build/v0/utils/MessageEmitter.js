'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const main_1 = require("../main");
const socket_io_1 = __importDefault(require("socket.io"));
const io = socket_io_1.default(main_1.server);
const Logger_1 = require("../utils/Logger");
const InstanceManager_1 = __importDefault(require("../utils/InstanceManager"));
const init = () => {
    io.on('connection', (socket) => {
        socket.on('start', (instanceKey) => {
            socket.join(instanceKey);
            Logger_1.logSuccessResponse({ instanceKey }, '[MESSAGE_EMITTER.JOIN_ROOM]');
            let salesforceUrl;
            ({ salesforceUrl } = InstanceManager_1.default.get(instanceKey, ["salesforceUrl"]));
            setAttribute(instanceKey, 'target-window', salesforceUrl);
        });
    });
};
init();
const setAttribute = (instanceKey, attribute, value) => {
    const keyedAttribute = {};
    keyedAttribute[`instance-key`] = instanceKey;
    keyedAttribute[`${attribute}`] = value;
    io.to(instanceKey).emit('setAttribute', keyedAttribute);
};
exports.default = {
    postTrigger: (instanceKey, topic, payload) => {
        try {
            io.to(instanceKey).emit('trigger', { topic, payload });
            Logger_1.logSuccessResponse(instanceKey, '[MESSAGE_EMITTER > POST_TRIGGER]');
        }
        catch (err) {
            Logger_1.logErrorResponse(err, '[MESSAGE_EMITTER > POST_TRIGGER]');
        }
    },
    postProgress: (instanceKey, src) => {
        let fileName, frontendBytes, externalBytes, fileSize;
        ({ fileName, frontendBytes, externalBytes, fileSize } = InstanceManager_1.default.get(instanceKey, ["fileName", "frontendBytes", "externalBytes", "fileSize"]));
        const percentCompletion = Math.floor((100 * (frontendBytes + externalBytes)) / (fileSize * 2));
        console.log(`[${fileName}][${src}_UPLOAD]: ${src == 'FRONTEND' ? frontendBytes / fileSize : externalBytes / fileSize}`);
        io.to(instanceKey).emit('progress', percentCompletion);
    },
    setAttribute,
};
