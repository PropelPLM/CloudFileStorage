'use strict';

const express = require('express');
const router = express.Router();

const { logSuccessResponse, logErrorResponse } = require('../lib/Logger.js');
const InstanceManager = require('../lib/InstanceManager.js');
const MessageEmitter = require('../lib/MessageEmitter.js');
const GoogleDrive = require('../lib/GoogleDrive.js');
const JsForce = require('../lib/JsForce.js');

router.post('/:instanceKey', async (req, res) => {
  const instanceKey = req.params.instanceKey;
  let sessionId, salesforceUrl, clientId, clientSecret;
  ({ sessionId, salesforceUrl, clientId, clientSecret } = req.body);

  InstanceManager.register(instanceKey);
  const instanceDetails = { salesforceUrl, clientId, clientSecret };
  await Promise.all([
    InstanceManager.add(instanceKey, instanceDetails),
    JsForce.connect(sessionId, salesforceUrl, instanceKey)
  ]);

  if (clientId && clientSecret) {
    const credentials = { clientId, clientSecret, redirect_uri: `https://${req.hostname}/auth/callback/google` }; //google can be swapped out
    const url = GoogleDrive.createAuthUrl(credentials, instanceKey);

    MessageEmitter.setAttribute(instanceKey, 'target-window', salesforceUrl);
    logSuccessResponse(instanceKey, '[END_POINT.AUTH_REDIRECT]');
    res.status(200).send({ url });
  } else {
    logErrorResponse({ clientId, clientSecret }, '[END_POINT.AUTH_REDIRECT]');
    res.status(400).send('Authorization failed, please ensure client credentials are populated.');
  }
});

router.get('/callback/google', async (req, res) => {
  const instanceKey = Buffer.from(req.query.state, 'base64').toString();
  const code = req.query.code;
  await GoogleDrive.getTokens(code, instanceKey);
  res.send('<script>window.close()</script>');
});

module.exports = router;
