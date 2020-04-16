"use-strict";

const express = require("express");
const util = require("util");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const { connect, updateRevId } = require("./lib/JsForce.js");

const app = express();
module.exports = server = require('http').createServer(app);
const port = process.env.PORT || 5000;
const GoogleDrive = require("./lib/GoogleDrive.js");

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, "../../public")));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "../../public/index.html");
});

app.post("/auth", async (req, res) => {
  ({ sessionId, salesforceUrl, clientId, clientSecret } = req.body);
  await connect(sessionId, salesforceUrl);
  if (clientId && clientSecret) {
    const credentials = {clientId, clientSecret, redirect_uri: `https://${req.hostname}/auth/callback/google`}; //google can be swapped out
    res.status(200).send(
      {
        "url": GoogleDrive.createAuthUrl(credentials)
      });
  } else {
    res.status(400).send({"Authorization failed, please ensure client credentials are populated."})
  }
});

app.get("/auth/callback/google", (req, res) => {
  const code = req.query.code;
  GoogleDrive.getTokens(code);
  res.send("<script>window.close()</script>");
});

var client_id;
var client_secret;
var tokensFromCredentials;

app.post("/uploadDetails", async (req, res) => {
  ({ revId, destinationFolderId } = req.body);
  updateRevId(revId);
  GoogleDrive.updateDestinationFolderId(destinationFolderId);
  sendSuccessResponse({ revId }, '/uploadDetails endpoint')
  res.status(200).send({ revId })
});

app.post("/token", (req, res) => {
  try {
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

    await connect(sessionId, salesforceUrl);
    sendSuccessResponse(tokensFromCredentials, "/tokens endpoint");
    res.status(200).send(tokensFromCredentials);
  } catch (err) {
    sendErrorResponse(err, "/tokens endpoint");
    res.send(`Failed to receive tokens: ${err}`);
  }
});

app.post("/upload", async (req, res) => {
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
    options = {
      fileName: fileName,
      mimeType: mimeType
    };
    // Authorize a client with credentials, then call the Google Drive API.
    const response = await GoogleDrive.authorize(
      client_id,
      client_secret,
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

function sendSuccessResponse(response, functionName) {
  const logEnding =
    Object.entries(response).length === 0 && response.constructor === Object
      ? ""
      : `: ${JSON.stringify(response)}`;
  console.log(`${functionName} has succeeded with a response${logEnding}.`);
  return response;
}

function sendErrorResponse(error, functionName) {
  console.log(`${functionName} has failed due to error: ${error}.`);
  return error;
}
