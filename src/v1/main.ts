'use strict';

import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import path from 'path';

require('dotenv').config(path.join(__dirname, '../../.env'))
const app: Application = express();
const server = require('http').createServer(app);
const port = process.env.PORT || 3030;
module.exports = server;

import InstanceManager from './utils/InstanceManager';
import authRouter from './routers/authRouter';
import uploadRouter from './routers/uploadRouter';
import platformOperationsRouter from './routers/platformOperationsRouter';

import { logSuccessResponse, logErrorResponse } from './utils/Logger';
import { responseGenerator } from './utils/middleware/responseGenerator';

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../../public')));

server.listen(port, async () => {
  try {
    await InstanceManager.connectToRedisServer();
    logSuccessResponse(`V1 INIT SUCCESS on port ${port}.`, '[SERVER_INIT]');
  } catch (err) {
    logErrorResponse(err, '[SERVER_INIT]');
  }
});

app.use('/auth', authRouter);
app.use('/upload', uploadRouter);
app.use('/platform', platformOperationsRouter);

app.get('/:instanceKey', (req: Request, res: Response) => {
  try {
    const instanceKey = req.params.instanceKey;
    logSuccessResponse(instanceKey, '[END_POINT.INSTANCE_KEY]');
    res.sendFile('index.html', { root: path.join(__dirname, '../../public/') });
  } catch (err) {
    logErrorResponse(err, '[END_POINT.INSTANCE_KEY]');
  }
});

app.use(responseGenerator);
