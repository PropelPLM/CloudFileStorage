'use strict';
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var server = require('../main');
var io = require('socket.io')(server);
var Logger_1 = require("../utils/Logger");
var InstanceManager_1 = __importDefault(require("../utils/InstanceManager"));
io.on('connection', function (socket) {
    socket.on('start', function (instanceKey) {
        socket.join(instanceKey);
        Logger_1.logSuccessResponse({ instanceKey: instanceKey }, '[MESSAGE_EMITTER.JOIN_ROOM]');
        var salesforceUrl;
        (salesforceUrl = InstanceManager_1.default.get(instanceKey, ['salesforceUrl']).salesforceUrl);
        setAttribute(instanceKey, 'target-window', salesforceUrl);
    });
});
var setAttribute = function (instanceKey, attribute, value) {
    var keyedAttribute = {};
    keyedAttribute["instance-key"] = instanceKey;
    keyedAttribute["" + attribute] = value;
    io.to(instanceKey).emit('setAttribute', keyedAttribute);
};
exports.default = {
    postTrigger: function (instanceKey, topic, payload) {
        console.log('posttrigger instanceKey: ', instanceKey);
        io.to(instanceKey).emit('trigger', { topic: topic, payload: payload });
    },
    postProgress: function (instanceKey, src) {
        var _a;
        var fileName, frontendBytes, externalBytes, fileSize;
        (_a = InstanceManager_1.default.get(instanceKey, ['fileName', 'frontendBytes', 'externalBytes', 'fileSize']), fileName = _a.fileName, frontendBytes = _a.frontendBytes, externalBytes = _a.externalBytes, fileSize = _a.fileSize);
        var percentCompletion = Math.floor((100 * (frontendBytes + externalBytes)) / (fileSize * 2));
        console.log("[" + fileName + "][" + src + "_UPLOAD]: " + (src == 'FRONTEND' ? frontendBytes / fileSize : externalBytes / fileSize));
        io.to(instanceKey).emit('progress', percentCompletion);
    },
    setAttribute: setAttribute,
};
