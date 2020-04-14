const { google } = require("googleapis");
const fs = require("fs");
const progress = require("progress-stream");
const { Transform } = require("stream");
const { create } = require("./JsForce.js");
const server = require("../main.js");
const io = require('socket.io')(server);
const util = require("util");

const redirect_uris = ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"];
const actions = {
  driveFiles: "https://www.googleapis.com/auth/drive.file"
}

var oAuth2Client;

function authorize(credentials) {
  oAuth2Client = new google.auth.OAuth2(credentials.clientId, credentials.clientSecret, credentials.redirect_uri)
  return oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: actions.driveFiles
  })
}

async function getTokens(code) {
  const getToken = util.promisify(oAuth2Client.getToken)
  return await getToken(code);
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

/**
 * Uploads file with an OAuth2 client and then execute communicate the metadata of
 * the record in the external file storage back to salesforce APEX.
 * @param {Object} auth OAuth2 client generated from authorizing the client credentials.
 * @param {Object} options Specifies how the file should be created in the external file storage
 */
async function uploadFile(auth, options) {
  var fileMetadata = {
    name: options.fileName,
    driveId: "0AKvbKuqsABhAUk9PVA", //hard coded drive
    parents: ["0AKvbKuqsABhAUk9PVA"] // and folder for demo
  };
  try {
    const drive = google.drive({ version: "v3", auth });
    var stat = fs.statSync(`./${options.fileName}`);
    var str = progress({ length: stat.size, time: 20 });
    str.on("progress", p => {
      console.log(`[UPLOAD-PROGRESS] percentage completion: ${p.percentage}`);
      io.emit('progress', p);
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
    const sfObject = await create(file.data);
    const response = {
      status: parseInt(file.status),
      data: {
        ...file.data,
        sfId: sfObject.id,
      }
    };
    return sendSuccessResponse(response, "uploadFile");
  } catch (err) {
    return sendErrorResponse(err, "uploadFile");
  }
}

function sendSuccessResponse(response, functionName) {
  console.log(
    `${functionName} has succeeded with response: ${JSON.stringify(response)}.`
  );
  return response;
}

function sendErrorResponse(error, functionName) {
  console.log(
    `${functionName} has failed due to error: ${JSON.stringify(error)}.`
  );
  return error;
}

module.exports = {
  actions,
  authorize,
  getTokens,
  uploadFile
};
