'use strict';

export = {};
const cors = require('cors');
const express = require('express');
const path = require('path');

const app = express();
const server = require('http').createServer(app);
module.exports = server;
const port = process.env.PORT || 5000;

const { logSuccessResponse, logErrorResponse } = require('./lib/Logger');
const authRouter = require('./routers/authRouter');
const uploadRouter = require('./routers/uploadRouter');

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../../public')));

server.listen(port, () => {
  try {
    logSuccessResponse('SUCCESS', '[SERVER_INIT]');
  } catch (error) {
    logErrorResponse(error, '[SERVER_INIT]');
  }
});

app.use('/auth', authRouter);
app.use('/upload', uploadRouter);

app.get('/:instanceKey', (req: any, res: any) => {
  try {
    const instanceKey = req.params.instanceKey;
    logSuccessResponse(instanceKey, '[END_POINT.INSTANCE_KEY]');
    res.sendFile('index.html', { root: path.join(__dirname, '../../public/') });
  } catch (error) {
    logErrorResponse(error, '[END_POINT.INSTANCE_KEY]');
  }
});
