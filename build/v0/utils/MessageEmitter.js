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
const server = require('../main');
const socket_io_1 = __importDefault(require("socket.io"));
const io = socket_io_1.default(server);
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
    init,
    postTrigger: (instanceKey, topic, payload) => {
        try {
            io.to(instanceKey).emit('trigger', { topic, payload });
            Logger_1.logSuccessResponse(instanceKey, '[MESSAGE_EMITTER > POST_TRIGGER]');
        }
        catch (err) {
            Logger_1.logErrorResponse(err, '[MESSAGE_EMITTER > POST_TRIGGER]');
        }
    },
    postProgress: (instanceKey, fileDetailKey, src) => {
        let fileName, fileDetails, totalFileSize, totalFrontendBytes, totalExternalBytes;
        ({ fileDetails } = InstanceManager_1.default.get(instanceKey, ["fileDetails"]));
        totalFileSize = totalFrontendBytes = totalExternalBytes = 0;
        for (const detail in fileDetails) {
            totalFileSize += fileDetails[detail].fileSize;
            totalFrontendBytes += fileDetails[detail].frontendBytes;
            totalExternalBytes += fileDetails[detail].externalBytes;
        }
        ({ fileName } = fileDetails[fileDetailKey]);
        const srcProgress = src == 'FRONTEND' ? totalFrontendBytes / totalFileSize : totalExternalBytes / totalFileSize;
        Logger_1.logProgressResponse(fileName, src, srcProgress);
        const percentCompletion = Math.floor(((totalFrontendBytes + totalExternalBytes) / (totalFileSize * 2)) * 100);
        io.to(instanceKey).emit('progress', percentCompletion);
    },
    setAttribute,
    tearDown: (test) => __awaiter(void 0, void 0, void 0, function* () {
        yield server.close();
        console.log(`closed from ${test}!`);
    })
};
