'use strict';

// Will be used more widely when there are different storages
const server = require('../main');
import ioSocket from 'socket.io';
const io = ioSocket(server);

import { logSuccessResponse, logErrorResponse, logProgressResponse } from './Logger';
import InstanceManager from './InstanceManager';

const init = () => {
  io.on('connection', (socket: any) => {
    socket.on('start', async (instanceKey: string) => {
      try {
        socket.join(instanceKey);
        logSuccessResponse({ instanceKey }, '[MESSAGE_EMITTER.JOIN_ROOM]');
      } catch (err) {
        logErrorResponse(err, '[MESSAGE_EMITTER.JOIN_ROOM]')
      }
      try {
        let salesforceUrl;
        ({ salesforceUrl } = await InstanceManager.get(instanceKey, [MapKey.salesforceUrl]));
        setAttribute(instanceKey, 'target-window', salesforceUrl);
      } catch (err) {
        logErrorResponse(err, '[MESSAGE_EMITTER.JOIN_ROOM.SET_ATTRIBUTE]')
      }
    });
  });
}
init();

const setAttribute = (instanceKey: string, attribute: string, value: string) => {
  const keyedAttribute: Record<string, string> = {};
  try {
    keyedAttribute[`instance-key`] = instanceKey;
    keyedAttribute[`${attribute}`] = value;
    io.to(instanceKey).emit('setAttribute', keyedAttribute);
    logSuccessResponse({ instanceKey, ...keyedAttribute }, '[MESSAGE_EMITTER.SET_ATTRIBUTE]');
  } catch (err) {
    logErrorResponse(err, '[MESSAGE_EMITTER.SET_ATTRIBUTE]')
    console.error({ keyedAttribute });
  }
}

export default {
  init,
  postTrigger: (instanceKey: string, topic: string, payload: any) => {
    try {
      io.to(instanceKey).emit('trigger', { topic, payload });
      logSuccessResponse(instanceKey, '[MESSAGE_EMITTER.POST_TRIGGER]')
    } catch (err) {
      logErrorResponse(err, '[MESSAGE_EMITTER.POST_TRIGGER]')
    }
  },

  postProgress: async (instanceKey: string, fileDetailsMap: Record<string, FileDetail>, fileDetailKey: string, src: string) => {
    let fileName: string, totalFileSize: number, totalFrontendBytes: number, totalExternalBytes: number;
    totalFileSize = totalFrontendBytes = totalExternalBytes = 0;
    for (const detail in fileDetailsMap) {
      totalFileSize += fileDetailsMap[detail].fileSize;
      totalFrontendBytes += fileDetailsMap[detail].frontendBytes;
      totalExternalBytes += fileDetailsMap[detail].externalBytes;
    }
    ({ fileName } = fileDetailsMap[fileDetailKey]);
    const srcProgress: number = src == 'FRONTEND' ? totalFrontendBytes/totalFileSize : totalExternalBytes/totalFileSize;
    logProgressResponse(fileName, src, srcProgress);
    const percentCompletion: number = Math.floor(((totalFrontendBytes + totalExternalBytes) / (totalFileSize * 2)) * 100);
    io.to(instanceKey).emit('progress', percentCompletion);
  },
  setAttribute,
  tearDown: async (test: string) => {
    await server.close();
    console.log(`closed from ${test}!`)
  }
};
