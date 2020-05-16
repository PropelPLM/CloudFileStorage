'use strict';

export {};
const express = require('express');
const router = express.Router();

const { logSuccessResponse, logErrorResponse } = require('../lib/Logger');
const InstanceManager = require('../lib/InstanceManager');
const MessageEmitter = require('../lib/MessageEmitter');
const GoogleDrive = require('../lib/GoogleDrive');
const JsForce = require('../lib/JsForce');

router.post('/:instanceKey', async (req: any, res: any) => {
  const instanceKey: string = req.params.instanceKey;
  let sessionId: string, salesforceUrl: string, clientId: string, clientSecret: string;
  ({ sessionId, salesforceUrl, clientId, clientSecret } = req.body);

  InstanceManager.register(instanceKey);
  const instanceDetails = { salesforceUrl, clientId, clientSecret };
  await Promise.all([
    InstanceManager.add(instanceKey, instanceDetails),
    JsForce.connect(sessionId, salesforceUrl, instanceKey)
  ]);

  if (clientId && clientSecret) {
    const credentials: Record<string, string> = { clientId, clientSecret, redirect_uri: `https://${req.hostname}/auth/callback/google` }; //google can be swapped out
    const url: string = GoogleDrive.createAuthUrl(credentials, instanceKey);

    MessageEmitter.setAttribute(instanceKey, 'target-window', salesforceUrl);
    logSuccessResponse(instanceKey, '[END_POINT.AUTH_REDIRECT]');
    res.status(200).send({ url });
  } else {
    logErrorResponse({ clientId, clientSecret }, '[END_POINT.AUTH_REDIRECT]');
    res.status(400).send('Authorization failed, please ensure client credentials are populated.');
  }
});

router.get('/callback/google', async (req: any, res: any) => {
  const instanceKey = Buffer.from(req.query.state, 'base64').toString();
  const code = req.query.code;
  const token: Record<string, string> = await GoogleDrive.getTokens(code, instanceKey);

  let clientId: string, clientSecret: string;
  ({ clientId, clientSecret } = InstanceManager.get(instanceKey, ['clientId', 'clientSecret']));
  await JsForce.sendTokens({ ...token, clientId, clientSecret }, instanceKey);
  
  res.send('<script>window.close()</script>');
});

module.exports = router;
