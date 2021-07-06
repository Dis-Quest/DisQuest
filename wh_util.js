
const fetch = require("node-fetch");

const wh_users = require("./wh_users.json");
const secrets  = require("./secrets.json");

function sendWHMessage(content) {
    let keys = Object.keys(wh_users);
    let user = keys[Math.floor(Math.random() * (keys.length + 1))];
    let avatar = wh_users[user];
    
    console.log(`user: ${user} avatar: ${avatar}`);
    
    fetch(secrets.webhook_url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            content: content,
            avatar_url: avatar,
            username: user,
            allowed_mentions: {
                parse: [],
            },
        }),
    });
}

module.exports = {
    sendWHMessage
}
