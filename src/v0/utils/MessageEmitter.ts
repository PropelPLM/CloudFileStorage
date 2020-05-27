// @ts-nocheck
'use strict';

// Will be used more widely when there are different storages
import { server } from '../main';
import ioSocket from 'socket.io';
const io = ioSocket(server);
console.log('server', server);
console.log('io', io);
import { logSuccessResponse, logErrorResponse } from '../utils/Logger';
import InstanceManager from '../utils/InstanceManager';

io.on('connection', (socket: any) => {
  socket.on('start', (instanceKey: string) => {
    socket.join(instanceKey);
    logSuccessResponse({ instanceKey }, '[MESSAGE_EMITTER.JOIN_ROOM]');
    let salesforceUrl;
    ({ salesforceUrl } = InstanceManager.get(instanceKey, [MapKey.salesforceUrl]));
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
    try {
      io.to(instanceKey).emit('trigger', { topic, payload });
      logSuccessResponse(instanceKey, '[MESSAGE_EMITTER > POST_TRIGGER]')
    } catch (err) {
      logErrorResponse(err, '[MESSAGE_EMITTER > POST_TRIGGER]')
    }
  },
  
  postProgress: (instanceKey: string, src: string) => {
    let fileName: string, frontendBytes: number, externalBytes: number, fileSize: number;
    ({ fileName, frontendBytes, externalBytes, fileSize } = InstanceManager.get(instanceKey, [MapKey.fileName, MapKey.frontendBytes, MapKey.externalBytes, MapKey.fileSize]));
    const percentCompletion: number = Math.floor((100 * (frontendBytes + externalBytes)) / (fileSize * 2))
    console.log(`[${fileName}][${src}_UPLOAD]: ${src == 'FRONTEND' ? frontendBytes/fileSize : externalBytes/fileSize}`);
    io.to(instanceKey).emit('progress', percentCompletion);
  },
  setAttribute,
};
