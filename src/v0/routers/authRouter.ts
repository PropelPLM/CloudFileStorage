'use strict';

export {};
import express from 'express';
const router = express.Router();
const path = require('path');

import { logSuccessResponse, logErrorResponse } from '../utils/Logger';
import InstanceManager from '../utils/InstanceManager';
import MessageEmitter from '../utils/MessageEmitter';
import GoogleDrive from '../platforms/GoogleDrive';
import JsForce from '../utils/JsForce';

router.get('/:instanceKey', (req, res)=> {
  InstanceManager.register(req.params.instanceKey);
  res.sendFile('index.html', { root: path.join(__dirname, '../../../public/') });
})

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
  try {

    const token: any = await GoogleDrive.getTokens(code, instanceKey);
  
    let clientId: string, clientSecret: string;
    ({ clientId, clientSecret } = InstanceManager.get(instanceKey, ['clientId', 'clientSecret']));
    await JsForce.sendTokens({ ...token.tokens, clientId, clientSecret }, instanceKey);
    MessageEmitter.postTrigger(instanceKey, 'authComplete', {});
    logSuccessResponse('MessageEmitted', '[CALLBACK_GOOGLE');
    res.send('<script>window.close()</script>');
  } catch (err) {
    logErrorResponse(err, '[CALLBACK_GOOGLE');
  }
});

module.exports = router;
