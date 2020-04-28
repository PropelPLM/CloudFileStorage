"use strict"

// Will be used more widely when there are different storages
const server = require("./main.js");
const io = require("socket.io")(server);

module.exports = {
    setKeyedAttribute: (key, attribute, value) => {
        const keyedAttribute = {}
        keyedAttribute[`${key}-${attribute}`] = value;
        io.emit("setAttribute", keyedAttribute)
    },
    postMessage: (instanceKey, topic, payload) => {
        console.log(instanceKey, topic, payload);
        io.emit("trigger", {instanceKey, topic, payload});
    }
}