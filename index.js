const fs = require("fs");
const readline = require("readline");
const { google } = require("googleapis");
const express = require("express");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.listen(PORT, () => console.log("done"));

var oAuth2Client;
app.get("/", async (req, res) => {
    const credentials = {
        installed: {
            client_id:
                "825658380789-phjeef4mt9r6q4udai91bppmsbised3h.apps.googleusercontent.com",
            project_id: "quickstart-1586505421981",
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url:
                "https://www.googleapis.com/oauth2/v1/certs",
            client_secret: "vhofPYueHwN09r7IuX2PRZKB",
            redirect_uris: [
                "https://lit-brook-82435.herokuapp.com/auth/callback",
            ],
        },
    };
    oAuth2Client = await authorize(credentials);
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
    });
    res.redirect(authUrl);
});

app.get("/auth/callback", async (req, res) => {
    const code = req.query.code;
    var tokens;
    oAuth2Client.getToken(code, (err, token) => {
        console.log(token);
        tokens = token;
    });
});
// Ln2K9hWbS1

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";

// // Load client secrets from a local file.
// const start = async () => {
//     fs.readFile("credentials.json", async (err, content) => {
//         if (err) return console.log("Error loading client secret file:", err);
//         // Authorize a client with credentials, then call the Google Drive API.
//         await authorize(JSON.parse(content), listFiles);
//     });
// };
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(credentials) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    return (oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
    ));

    // // Check if we have previously stored a token.
    // fs.readFile(TOKEN_PATH, (err, token) => {
    //     if (err) return getAccessToken(oAuth2Client, callback);
    //     oAuth2Client.setCredentials(JSON.parse(token));
    //     callback(oAuth2Client);
    // });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
    });
    console.log("Authorize this app by visiting this url:", authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question("Enter the code from that page here: ", (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error("Error retrieving access token", err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log("Token stored to", TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listFiles(auth) {
    const drive = google.drive({ version: "v3", auth });
    drive.files.list(
        {
            pageSize: 10,
            fields: "nextPageToken, files(id, name)",
        },
        (err, res) => {
            if (err) return console.log("The API returned an error: " + err);
            const files = res.data.files;
            if (files.length) {
                console.log("Files:");
                files.map((file) => {
                    console.log(`${file.name} (${file.id})`);
                });
            } else {
                console.log("No files found.");
            }
        }
    );
}
