"use strict";

const cors = require("cors");
const express = require("express");
const multer = require("multer");
const path = require("path");
const util = require("util");

const InstanceManager = require("./InstanceManager.js");
const GoogleDrive = require("./lib/GoogleDrive.js");
const JsForce = require("./lib/JsForce.js");

const app = express();
const server = require("http").createServer(app);
module.exports = server;
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../../public")));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "../../public/index.html");
});

app.post("/auth", async (req, res) => {
  let sessionId, salesforceUrl, clientId, clientSecret;
  ({ sessionId, salesforceUrl, clientId, clientSecret } = req.body);

  // const instanceKey = InstanceManager.start(sessionId);
  const instanceKey = InstanceManager.start("instanceKey");
  const instanceDetails = { salesforceUrl, clientId, clientSecret };
  InstanceManager.add(instanceKey, instanceDetails);
  console.log("instanceKey", instanceKey);
  await JsForce.connect(sessionId, salesforceUrl, instanceKey);

  if (clientId && clientSecret) {
    const credentials = {clientId, clientSecret, redirect_uri: `https://${req.hostname}/auth/callback/google`}; //google can be swapped out
    res.status(200).send({ "url": GoogleDrive.createAuthUrl(credentials, instanceKey) });
  } else {
    res.status(400).send("Authorization failed, please ensure client credentials are populated.");
  }
});

app.get("/auth/callback/google", (req, res) => {
  const instanceKey = Buffer.from(req.query.state, "base64").toString();
  console.log("callbackk");
  console.log("instanceKey", instanceKey);
  const code = req.query.code;
  GoogleDrive.getTokens(code, instanceKey);
  res.send("<script>window.close()</script>");
});

app.post("/uploadDetails", async (req, res) => {
  let revId, destinationFolderId, sessionId, salesforceUrl;
  ({ revId, destinationFolderId, sessionId, salesforceUrl } = req.body);

  const instanceKey = sessionId + revisionId;
  const instanceDetails = { revisionId: revId, destinationFolderId };
  InstanceManager.add(instanceKey, instanceDetails);
  GoogleDrive.setInstanceOnForm(instanceKey);

  logSuccessResponse({ revId }, "[ENDPOINT.UPLOAD_DETAILS]")
  res.status(200).send({ revId })
});

app.post("/token", async (req, res) => {
  try {
    let client_secret, client_id, access_token, refresh_token, expiry_date, sessionId, salesforceUrl, revisionId, tokensFromCredentials;
    ({
      client_secret,
      client_id,
      access_token,
      refresh_token,
      expiry_date,
      sessionId,
      salesforceUrl, 
      revisionId
    } = req.body);

    tokensFromCredentials = {
      access_token,
      refresh_token,
      scope: GoogleDrive.actions.driveFiles,
      token_type: "Bearer",
      expiry_date
    };

    const instanceKey = InstanceManager.startWithRevId(sessionId, revisionId);
    const instanceDetails = { sessionId, salesforceUrl, clientId: client_id, clientSecret: client_secret, tokensFromCredentials, revisionId };
    InstanceManager.add(instanceKey, instanceDetails);

    await JsForce.connect(sessionId, salesforceUrl);
    logSuccessResponse(tokensFromCredentials, "[ENDPOINT.TOKEN]");
    res.status(200).send(tokensFromCredentials);
  } catch (err) {
    logErrorResponse(err, "[ENDPOINT.TOKEN]");
    res.send(`Failed to receive tokens: ${err}`);
  }
});

app.post("/upload/:instanceKey", async (req, res) => {
  const instanceKey = req.params.instanceKey;
  var fileName;
  var mimeType;
  var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, "./");
    },
    filename: function (req, file, cb) {
      fileName = file.originalname || file.name;
      mimeType = file.mimetype;
      cb(null, fileName);
    }
  });
  var upload = util.promisify(multer({ storage: storage }).single("file"));
  try {
    await upload(req, res);
  } catch (err) {
    console.log(`Upload from local failed with ${err}`);
  }
  try {
    let clientId, clientSecret, tokensFromCredentials;

    ({ clientId, clientSecret, tokensFromCredentials } = InstanceManager.get(instanceKey, ["clientId", "clientSecret", "tokensFromCredentials"]));

    options = { fileName, mimeType, instanceKey };
    const response = await GoogleDrive.authorize(
      clientId,
      clientSecret,
      tokensFromCredentials,
      options,
      GoogleDrive.uploadFile
    );
    res.status(response.status).send(response.data);
    return response;
  } catch (err) {
    res.status(503).send(`Drive upload failed: ${err}`);
  }
});

server.listen(port, () => {
  console.log("Endpoints ready.");
});

function logSuccessResponse(response, functionName) {
  const logEnding =
    Object.entries(response).length === 0 && response.constructor === Object
      ? ""
      : `: ${JSON.stringify(response)}`;
  console.log(`${functionName} has succeeded with a response${logEnding}.`);
  return response;
}

function logErrorResponse(error, functionName) {
  console.log(`${functionName} has failed due to error: ${error}.`);
  return error;
}
