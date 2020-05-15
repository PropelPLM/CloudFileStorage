'use strict';
var server = require('../main');
var io = require('socket.io')(server);
var logSuccessResponse = require('./Logger').logSuccessResponse;
var InstanceManager = require('./InstanceManager');
io.on('connection', function (socket) {
    socket.on('start', function (instanceKey) {
        socket.join(instanceKey);
        logSuccessResponse({ instanceKey: instanceKey }, '[MESSAGE_EMITTER.JOIN_ROOM]');
        var salesforceUrl;
        (salesforceUrl = InstanceManager.get(instanceKey, ['salesforceUrl']).salesforceUrl);
        setAttribute(instanceKey, 'target-window', salesforceUrl);
    });
});
var setAttribute = function (instanceKey, attribute, value) {
    var keyedAttribute = {};
    keyedAttribute["instance-key"] = instanceKey;
    keyedAttribute["" + attribute] = value;
    io.to(instanceKey).emit('setAttribute', keyedAttribute);
};
module.exports = {
    postTrigger: function (instanceKey, topic, payload) {
        io.to(instanceKey).emit('trigger', { topic: topic, payload: payload });
    },
    postProgress: function (instanceKey, src) {
        var _a;
        var frontendBytes, externalBytes, fileSize;
        (_a = InstanceManager.get(instanceKey, ['frontendBytes', 'externalBytes', 'fileSize']), frontendBytes = _a.frontendBytes, externalBytes = _a.externalBytes, fileSize = _a.fileSize);
        var percentCompletion = parseInt((100 * (frontendBytes + externalBytes)) / (fileSize * 2));
        console.log("[" + instanceKey + "][" + src + "_UPLOAD]: " + (src == 'frontend' ? frontendBytes / fileSize : externalBytes / fileSize));
        io.to(instanceKey).emit('progress', percentCompletion);
    },
    setAttribute: setAttribute,
};
