'use strict';

import cors from 'cors';
import express from 'express';
import path from 'path';

const app = express();
const server = require('http').createServer(app);
const port = process.env.PORT || 6000;
module.exports = server;

import { logSuccessResponse, logErrorResponse } from './utils/Logger';
import authRouter from './routers/authRouter';
import uploadRouter from './routers/uploadRouter';

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../../public')));

if (process.argv[2] == 'PRODUCTION') {
  server.listen(port, () => {
    try {
      logSuccessResponse('SUCCESS', '[SERVER_INIT]');
    } catch (err) {
      logErrorResponse(err, '[SERVER_INIT]');
    }
  });
}

app.use('/auth', authRouter);
app.use('/upload', uploadRouter);

app.get('/:instanceKey', (req: any, res: any) => {
  try {
    const instanceKey = req.params.instanceKey;
    logSuccessResponse(instanceKey, '[END_POINT.INSTANCE_KEY]');
    res.sendFile('index.html', { root: path.join(__dirname, '../../public/') });
  } catch (err) {
    logErrorResponse(err, '[END_POINT.INSTANCE_KEY]');
  }
});
