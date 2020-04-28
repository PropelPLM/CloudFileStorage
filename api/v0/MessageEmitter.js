"use strict"

// Will be used more widely when there are different storages
const server = require("./main.js");
const io = require("socket.io")(server);

console.log('message server', server)

module.exports = {
    setKeyedAttribute: (key, attribute, value) => {
        const keyedAttribute = {}
        keyedAttribute[`${key}-${attribute}`] = value;
        io.emit("setAttribute", keyedAttribute)
    },
    postMessage: (topic, payload) => {
        io.emit(topic, payload);
    }
}