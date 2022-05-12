'use strict';

import express from 'express';
const router = express.Router();
import path from 'path';

import { logSuccessResponse, logErrorResponse } from '../utils/Logger';
import InstanceManager from '../utils/InstanceManager';
import MessageEmitter from '../utils/MessageEmitter';
import GoogleDrive from '../platforms/GoogleDrive/GoogleDrive';
import JsForce from '../utils/JsForce';

router.get('/:instanceKey', async (req, res)=> {
  await InstanceManager.register(req.params.instanceKey);
  res.sendFile('index.html', { root: path.join(__dirname, '../../../public/') });
})

router.post('/:instanceKey/', async (req: any, res: any) => {
  let instanceKey: string = req.params.instanceKey;
  let sessionId: string, salesforceUrl: string, clientId: string, clientSecret: string, tenantId: string;
  ({ sessionId, salesforceUrl, clientId, clientSecret, tenantId } = req.body);

  const instanceDetails = { salesforceUrl, clientId, clientSecret, tenantId, sessionId };

  try {
    await InstanceManager.upsert(instanceKey, instanceDetails);

    if (clientId && clientSecret) {
      const credentials: Record<string, string> = { clientId, clientSecret, redirect_uri: `https://${req.hostname}/auth/callback/google` }; //google can be swapped out
      const url: string = GoogleDrive.createAuthUrl(credentials, instanceKey);

      MessageEmitter.setAttribute(instanceKey, 'target-window', salesforceUrl);
      logSuccessResponse(instanceKey, '[END_POINT.AUTH_REDIRECT]');
      res.status(200).send({ url });
    } else {
      throw new Error('Client Id or secret is missing.')
    }
  } catch (err) {
    logErrorResponse( err, '[END_POINT.AUTH_REDIRECT]');
    res.status(400).send(`Authorization failed, please check your credentials: ${err}`);
  }
});

router.get('/callback/google', async (req: any, res: any) => {
  const instanceKey = Buffer.from(req.query.state, 'base64').toString();
  const code = req.query.code;
  try {
    const token: Record<string, any> = await GoogleDrive.getTokens!(code, instanceKey, req.hostname);
    let clientId: string, clientSecret: string;
    ({ clientId, clientSecret } = await InstanceManager.get(instanceKey, [MapKey.clientId, MapKey.clientSecret]));

    if (token.tokens) {
      await JsForce.sendTokens({ ...token.tokens, clientId, clientSecret }, instanceKey);
    } else {
      throw new Error('No tokens found in Google Drive callback.')
    }
    MessageEmitter.postTrigger(instanceKey, 'authComplete', {});
    logSuccessResponse('MessageEmitted', '[CALLBACK_GOOGLE');
    res.send('<script>window.close()</script>');
  } catch (err) {
    MessageEmitter.postTrigger(instanceKey, 'authFailed', {});
    res.status(500).send(`Callback from google has failed: ${err}`);
    logErrorResponse(err, '[CALLBACK_GOOGLE');
  }
});

export default router;
