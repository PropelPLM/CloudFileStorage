'use strict';

// Will be used more widely when there are different storages
const server = require('../main');
const io = require('socket.io')(server);
const { logSuccessResponse } = require('./Logger');
const InstanceManager = require('./InstanceManager');

io.on('connection', (socket) => {
  socket.on('start', (instanceKey) => {
    socket.join(instanceKey);
    logSuccessResponse({ instanceKey }, '[MESSAGE_EMITTER.JOIN_ROOM]');
    let salesforceUrl;
    ({ salesforceUrl } = InstanceManager.get(instanceKey, ['salesforceUrl']));
    setAttribute(instanceKey, 'target-window', salesforceUrl);
  });
});

const setAttribute = (instanceKey, attribute, value) => {
  const keyedAttribute = {};
  keyedAttribute[`instance-key`] = instanceKey;
  keyedAttribute[`${attribute}`] = value;
  io.to(instanceKey).emit('setAttribute', keyedAttribute);
}

module.exports = {
  postTrigger: (instanceKey, topic, payload) => {
    io.to(instanceKey).emit('trigger', { topic, payload });
  },

  postProgress: (instanceKey, src) => {
    let frontendBytes, externalBytes, fileSize;
    ({ frontendBytes, externalBytes, fileSize } = InstanceManager.get(instanceKey, ['frontendBytes', 'externalBytes', 'fileSize']));
    const percentCompletion = parseInt((100 * (frontendBytes + externalBytes)) / (fileSize * 2))
    console.log(`[${instanceKey}][${src}_UPLOAD]: ${src == 'frontend' ? frontendBytes/fileSize : externalBytes/fileSize}`);
    io.to(instanceKey).emit('progress', percentCompletion);
  },
  setAttribute,
};
