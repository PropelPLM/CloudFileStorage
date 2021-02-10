'use strict';

// Will be used more widely when there are different storages
const server = require('../main');
import ioSocket from 'socket.io';
const io = ioSocket(server);

import { logSuccessResponse, logErrorResponse, logProgressResponse } from '../utils/Logger';
import InstanceManager from '../utils/InstanceManager';

const init = () => {
  io.on('connection', (socket: any) => {
    socket.on('start', (instanceKey: string) => {
      socket.join(instanceKey);
      logSuccessResponse({ instanceKey }, '[MESSAGE_EMITTER.JOIN_ROOM]');
      let salesforceUrl;
      ({ salesforceUrl } = InstanceManager.get(instanceKey, [MapKey.salesforceUrl]));
      setAttribute(instanceKey, 'target-window', salesforceUrl);
    });
  });
}
init();

const setAttribute = (instanceKey: string, attribute: string, value: string) => {
  const keyedAttribute: Record<string, string> = {};
  keyedAttribute[`instance-key`] = instanceKey;
  keyedAttribute[`${attribute}`] = value;
  io.to(instanceKey).emit('setAttribute', keyedAttribute);
}

export default {
  init,
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
    const srcProgress: number = src == 'FRONTEND' ? frontendBytes/fileSize : externalBytes/fileSize;
    logProgressResponse(fileName, src, srcProgress);
    const percentCompletion: number = Math.floor((100 * (frontendBytes + externalBytes)) / (fileSize * 2))
    io.to(instanceKey).emit('progress', percentCompletion);
  },
  setAttribute,
};
