
const fs = require("fs");

let urls = require("./urls.json");

let listeners = [];

function save(content) {
    urls = content;
    fs.renameSync("./urls.json", "urls.json.old");
    fs.writeFileSync("./urls.json", content);
    listeners.forEach(l => l());
}

/**
 * Add an update listener.
 * @param listener {function} the update listener.
 */
function addUpdateListener(listener) {
    listeners.push(listener);
}

module.exports = {
    save, addUpdateListener
}
