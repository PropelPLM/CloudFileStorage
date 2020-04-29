"use strict";

const cors = require("cors");
const express = require("express");
const multer = require("multer");
const path = require("path");
const util = require("util");

const app = express();
const server = require("http").createServer(app);
module.exports = server;
const port = process.env.PORT || 5000;

const InstanceManager = require("./InstanceManager.js");
const MessageEmitter = require("./MessageEmitter.js");
const GoogleDrive = require("./lib/GoogleDrive.js");
const JsForce = require("./lib/JsForce.js");

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../../public")));

app.get("/:instanceKey", (req, res) => {
  const instanceKey = req.params.instanceKey;
  logSuccessResponse(instanceKey, "[ENDPOINT.INSTANCE_KEY]");
  res.sendFile("index.html", {root: path.join(__dirname, "../../public/")});
});

app.get("/setAttribute/:instanceKey", (req, res) => {
  const instanceKey = req.params.instanceKey;
  logSuccessResponse(instanceKey, "[ENDPOINT.SET_ATTRIBUTE]");
  res.send("OK")
  let salesforceUrl;
  ({ salesforceUrl} = InstanceManager.get(instanceKey, ["salesforceUrl"]));
  MessageEmitter.setAttribute(instanceKey, "target-window", salesforceUrl);
});

app.post("/auth", async (req, res) => {
  let sessionId, salesforceUrl, clientId, clientSecret;
  ({ sessionId, salesforceUrl, clientId, clientSecret } = req.body);

  InstanceManager.register(instanceKey);
  MessageEmitter.setAttribute(instanceKey, "target-window", salesforceUrl);
  const instanceDetails = { salesforceUrl, clientId, clientSecret };
  await Promise.all([
    InstanceManager.add(instanceKey, instanceDetails),
    JsForce.connect(sessionId, salesforceUrl, instanceKey)
  ])

  if (clientId && clientSecret) {
    const credentials = {clientId, clientSecret, redirect_uri: `https://${req.hostname}/auth/callback/google`}; //google can be swapped out
    res.status(200).send({ "url": GoogleDrive.createAuthUrl(credentials, instanceKey) });
  } else {
    res.status(400).send("Authorization failed, please ensure client credentials are populated.");
  }
});

app.get("/auth/callback/google", async (req, res) => {
  const instanceKey = Buffer.from(req.query.state, "base64").toString();
  const code = req.query.code;
  await GoogleDrive.getTokens(code, instanceKey);
  res.send("<script>window.close()</script>");
});

app.post("/token/:instanceKey", async (req, res) => {
  const instanceKey = req.params.instanceKey;
  try {
    let client_secret, client_id, access_token, refresh_token, expiry_date, sessionId, salesforceUrl, tokensFromCredentials;
    ({
      client_secret,
      client_id,
      access_token,
      refresh_token,
      expiry_date,
      sessionId,
      salesforceUrl
    } = req.body);

    tokensFromCredentials = {
      access_token,
      refresh_token,
      scope: GoogleDrive.actions.driveFiles,
      token_type: "Bearer",
      expiry_date
    };

    InstanceManager.register(instanceKey);
    const instanceDetails = { sessionId, salesforceUrl, clientId: client_id, clientSecret: client_secret, tokensFromCredentials };
    InstanceManager.add(instanceKey, instanceDetails);

    await JsForce.connect(sessionId, salesforceUrl, instanceKey);
    logSuccessResponse(tokensFromCredentials, "[ENDPOINT.TOKEN]");
    res.status(200).send({...tokensFromCredentials, instanceKey});
  } catch (err) {
    logErrorResponse(err, "[ENDPOINT.TOKEN]");
    res.send(`Failed to receive tokens: ${err}`);
  }
});

app.post("/uploadDetails/:instanceKey", async (req, res) => {
  const instanceKey = req.params.instanceKey;
  let revisionId, destinationFolderId;
  ({ revisionId, destinationFolderId } = req.body); 
  const instanceDetails = { revisionId, destinationFolderId };
  InstanceManager.add(instanceKey, instanceDetails);
  logSuccessResponse({ instanceKey }, "[ENDPOINT.UPLOAD_DETAILS]");
  res.status(200).send({ instanceKey });
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
