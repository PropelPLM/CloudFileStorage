'use strict';

// Will be used more widely when there are different storages
const server = require('./main.js');
const io = require('socket.io')(server);
const { logSuccessResponse } = require('./Logger.js');
const InstanceManager = require('./InstanceManager.js');

io.on('connection', (socket) => {
  socket.on('start', (instanceKey) => {
    socket.join(instanceKey);
    logSuccessResponse({ instanceKey }, '[MESSAGE_EMITTER.JOIN_ROOM]');
  });
});

module.exports = {
  setAttribute: (instanceKey, attribute, value) => {
    const keyedAttribute = {};
    keyedAttribute[`instance-key`] = instanceKey;
    keyedAttribute[`${attribute}`] = value;
    io.to(instanceKey).emit('setAttribute', keyedAttribute);
  },

  postTrigger: (instanceKey, topic, payload) => {
    io.to(instanceKey).emit('trigger', { topic, payload });
  },

  postProgress: (instanceKey, src) => {
    let frontendBytes, externalBytes, totalBytes;
    ({ frontendBytes, externalBytes, totalBytes } = InstanceManager.get(instanceKey, ['frontendBytes', 'externalBytes', 'totalBytes']));
    const percentCompletion = parseInt((100 * (frontendBytes + externalBytes)) / (totalBytes * 2))
    console.log(`${src} ${src == 'frontend' ? frontendBytes : externalBytes}`);
    io.to(instanceKey).emit('progress', percentCompletion);
  },
};
