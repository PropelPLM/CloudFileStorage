'use strict';

export {};
// Will be used more widely when there are different storages
const server = require('../main');
const io = require('socket.io')(server);
const { logSuccessResponse } = require('./Logger');
const InstanceManager = require('./InstanceManager');

io.on('connection', (socket: any) => {
  socket.on('start', (instanceKey: string) => {
    socket.join(instanceKey);
    logSuccessResponse({ instanceKey }, '[MESSAGE_EMITTER.JOIN_ROOM]');
    let salesforceUrl;
    ({ salesforceUrl } = InstanceManager.get(instanceKey, ['salesforceUrl']));
    setAttribute(instanceKey, 'target-window', salesforceUrl);
  });
});

const setAttribute = (instanceKey: string, attribute: string, value: string) => {
  const keyedAttribute: Record<string, string> = {};
  keyedAttribute[`instance-key`] = instanceKey;
  keyedAttribute[`${attribute}`] = value;
  io.to(instanceKey).emit('setAttribute', keyedAttribute);
}

module.exports = {
  postTrigger: (instanceKey: string, topic: string, payload: any) => {
    io.to(instanceKey).emit('trigger', { topic, payload });
  },

  postProgress: (instanceKey: string, src: string) => {
    let frontendBytes: number, externalBytes: number, fileSize: number;
    ({ frontendBytes, externalBytes, fileSize } = InstanceManager.get(instanceKey, ['frontendBytes', 'externalBytes', 'fileSize']));
    const percentCompletion: number = Math.floor((100 * (frontendBytes + externalBytes)) / (fileSize * 2))
    console.log(`[${instanceKey}][${src}_UPLOAD]: ${src == 'frontend' ? frontendBytes/fileSize : externalBytes/fileSize}`);
    io.to(instanceKey).emit('progress', percentCompletion);
  },
  setAttribute,
};
