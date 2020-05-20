'use strict';

export {};
// Will be used more widely when there are different storages
const server = require('../main');
const io = require('socket.io')(server);
import { logSuccessResponse } from '../utils/Logger';
import InstanceManager from '../utils/InstanceManager';

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

export default {
  postTrigger: (instanceKey: string, topic: string, payload: any) => {
    console.log('posttrigger instanceKey: ', instanceKey)
    io.to(instanceKey).emit('trigger', { topic, payload });
  },
  
  postProgress: (instanceKey: string, src: string) => {
    let fileName: string, frontendBytes: number, externalBytes: number, fileSize: number;
    ({ fileName, frontendBytes, externalBytes, fileSize } = InstanceManager.get(instanceKey, ['fileName', 'frontendBytes', 'externalBytes', 'fileSize']));
    const percentCompletion: number = Math.floor((100 * (frontendBytes + externalBytes)) / (fileSize * 2))
    console.log(`[${fileName}][${src}_UPLOAD]: ${src == 'FRONTEND' ? frontendBytes/fileSize : externalBytes/fileSize}`);
    io.to(instanceKey).emit('progress', percentCompletion);
  },
  setAttribute,
};
