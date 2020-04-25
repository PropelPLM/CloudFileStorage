const { google } = require("googleapis");
const { Transform } = require("stream");
const fs = require("fs");
const progress = require("progress-stream");
const server = require("../main.js");
const io = require("socket.io")(server);

const JsForce = require("./JsForce.js");

const redirect_uris = ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"];
const actions = {
  driveFiles: "https://www.googleapis.com/auth/drive.file"
}

var oAuth2Client;
var clientId;
var clientSecret;
var destinationFolderId;
var salesforceUrl

function createAuthUrl(credentials, instanceKey) {
  let clientId, clientSecret, redirect_uri;
  ({clientId, clientSecret, redirect_uri} = credentials)
  oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, redirect_uri)
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: actions.driveFiles,
    state: Buffer.from(instanceKey).toString('base64')
  });
}

async function getTokens(code) {
  oAuth2Client.getToken(code, (err, token) => {
    JsForce.sendTokens({...token, clientId, clientSecret});
  })
  io.emit("authComplete", {});
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {String} clientId Client ID from Google API console
 * @param {String} clientSecret Client Secret from Google API console
 * @param {Object} tokens Acces and Refresh tokens and their expiry
 * @param {Object} options Specifies how the operation in the callback should be
 *                 executed in the external file storage
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(clientId, clientSecret, tokens, options, callback) {
  const oAuth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirect_uris[0]
  );
  oAuth2Client.setCredentials(tokens);
  return await callback(oAuth2Client, options);
}

function updateDestinationFolderId(folderId) {
  destinationFolderId = folderId;
}

/**
 * Uploads file with an OAuth2 client and then execute communicate the metadata of
 * the record in the external file storage back to salesforce APEX.
 * @param {Object} auth OAuth2 client generated from authorizing the client credentials.
 * @param {Object} options Specifies how the file should be created in the external file storage
 */
async function uploadFile(auth, options) {
  var fileMetadata = {
    name: options.fileName,
    driveId: destinationFolderId,
    parents: [destinationFolderId]
  };
  try {
    const drive = google.drive({ version: "v3", auth });
    var stat = fs.statSync(`./${options.fileName}`);
    var str = progress({ length: stat.size, time: 20 });
    str.on("progress", p => {
      io.emit("progress", p);
    });
    let fileStream = new Transform({
      transform(chunk, encoding, callback) {
        this.push(chunk);
        callback();
      }
    });
    fs.createReadStream(`./${options.fileName}`)
    .pipe(str)
    .pipe(fileStream);
    var media = {
      mimeType: options.mimeType,
      body: fileStream
    };
    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      supportsAllDrives: true,
      fields: "id, name, webViewLink, mimeType, fileExtension, webContentLink"
    });
    const sfObject = await JsForce.create(file.data);
    const response = {
      status: parseInt(file.status),
      data: {
        ...file.data,
        sfId: sfObject.id,
        revisionId: sfObject.revisionId,
        salesforceUrl
      }
    };
    logSuccessResponse(response, "[GOOGLEDRIVE.UPLOAD_FILE]");
    return response;
  } catch (err) {
    return logErrorResponse(err, "[GOOGLEDRIVE.UPLOAD_FILE]");
  }
}

function registerSalesforceUrl(url) {
  salesforceUrl = url
}

function logSuccessResponse(response, functionName) {
  console.log(
    `${functionName} has succeeded with response: ${JSON.stringify(response)}.`
  );
  return response;
}

function logErrorResponse(error, functionName) {
  console.log(
    `${functionName} has failed due to error: ${JSON.stringify(error)}.`
  );
  return error;
}

module.exports = {
  actions,
  authorize,
  createAuthUrl,
  getTokens,
  registerSalesforceUrl,
  updateDestinationFolderId,
  uploadFile
};
