'use strict';

// Will be used more widely when there are different storages
const server = require('../main');
import { Server } from 'socket.io';
const io = new Server(server);

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

  postProgress: (instanceKey: string, fileDetailKey: string, src: string) => {
    let fileName: string, fileDetails: Record<string, FileDetail>, totalFileSize: number, totalFrontendBytes: number, totalExternalBytes: number;
    ({ fileDetails } = InstanceManager.get(instanceKey, [MapKey.fileDetails]));
    totalFileSize = totalFrontendBytes = totalExternalBytes = 0;
    for (const detail in fileDetails) {
      totalFileSize += fileDetails[detail].fileSize;
      totalFrontendBytes += fileDetails[detail].frontendBytes;
      totalExternalBytes += fileDetails[detail].externalBytes;
    }
    ({ fileName } = fileDetails[fileDetailKey]);
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
