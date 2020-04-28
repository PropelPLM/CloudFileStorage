"use strict"

// Will be used more widely when there are different storages
const server = require("./main.js");
const io = require("socket.io")(server);

module.exports = {
    init: (instanceKey) => {
        io.on('connection', socket => {
            socket.on('start', () => {
                socket.join(instanceKey);
            });
        });
    },
    setAttribute: (instanceKey, attribute, value) => {
        const keyedAttribute = {}
        keyedAttribute[`instance-key`] = instanceKey;
        keyedAttribute[`${attribute}`] = value;
        console.log('keyedAttribute', keyedAttribute)
        io.to(instanceKey).emit("setAttribute", keyedAttribute);
    },
    postTrigger: (instanceKey, topic, payload) => {
        io.to(instanceKey).emit("trigger", {topic, payload});
    },
    postProgress: (instanceKey, payload) => {
        io.to(instanceKey).emit("progress", payload);
    }
}