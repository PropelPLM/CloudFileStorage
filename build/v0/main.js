'use strict';
var cors = require('cors');
var express = require('express');
var path = require('path');
var app = express();
var server = require('http').createServer(app);
module.exports = server;
var port = process.env.PORT || 5000;
var _a = require('./utils/Logger'), logSuccessResponse = _a.logSuccessResponse, logErrorResponse = _a.logErrorResponse;
var authRouter = require('./routers/authRouter');
var uploadRouter = require('./routers/uploadRouter');
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, '../../public')));
server.listen(port, function () {
    try {
        logSuccessResponse('SUCCESS', '[SERVER_INIT]');
    }
    catch (error) {
        logErrorResponse(error, '[SERVER_INIT]');
    }
});
app.use('/auth', authRouter);
app.use('/upload', uploadRouter);
app.get('/:instanceKey', function (req, res) {
    try {
        var instanceKey = req.params.instanceKey;
        logSuccessResponse(instanceKey, '[END_POINT.INSTANCE_KEY]');
        res.sendFile('index.html', { root: path.join(__dirname, '../../public/') });
    }
    catch (error) {
        logErrorResponse(error, '[END_POINT.INSTANCE_KEY]');
    }
});
module.exports = {};
