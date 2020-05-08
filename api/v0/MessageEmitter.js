'use strict';

// Will be used more widely when there are different storages
const server = require('./main.js');
const io = require('socket.io')(server);
const { logSuccessResponse } = require('./Logger.js');

io.on('connection', (socket) => {
  socket.on('start', (instanceKey) => {
    socket.join(instanceKey);
    logSuccessResponse({ instanceKey }, '[MESSAGE_EMITTER.JOIN_ROOM]');
  });
});

const progressMap = {}

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

  postProgress: (instanceKey, src, bytesReceived, totalBytes) => {
    if (!progressMap[instanceKey]) {
      progressMap[instanceKey] = {}
      progressMap[instanceKey]['totalBytes'] = totalBytes * 2;
      progressMap[instanceKey]['bytes'] = 0;
      console.log(`totalBytes: ${totalBytes}`);
    }
    const currentProgress = progressMap[instanceKey]['bytes'] + bytesReceived;
    console.log(`${src} ${percentCompletion}%`);
    progressMap[instanceKey]['bytes'] =  currentProgress;
    const percentCompletion = parseInt(100 * currentProgress / progressMap[instanceKey]['totalBytes']);
    console.log(`[${src}_UPLOAD_PROGRESS]`, `${percentCompletion}%`);
    io.to(instanceKey).emit('progress', percentCompletion);
  },
};
