const jsConnect = require("jsforce");
var connection;

async function connect(sessionId, salesforceUrl) {
  try {
    connection = new jsConnect.Connection({
      instanceUrl: salesforceUrl,
      sessionId
    });
    console.log(connection)
  } catch (err) {
    console.log(`log in failed: ${err}`);
  }
}

function create(file) {
  ({ name, webViewLink, id, fileExtension } = file);
  console.log(name)
  console.log(webViewLink)
  console.log(id)
  console.log(fileExtension)

  connection
    .sobject("PLMLAW__Document__c")
    .create({
      Name: name,
      PLMLAW__Item_Revision__c: "a0V6g000000KFZmEAO", //hardcoded just for demo
      PLMLAW__External_Attachment_URL__c: webViewLink,
      PLMLAW__File_Extension__c: fileExtension,
      PLMLAW__Google_File_Id__c: id
    })
    .then(res => console.log("well done: " + fileExtension))
    .catch(err => console.log("sike: " + err));
  console.log('done')
}

module.exports = {
  connect,
  create
};