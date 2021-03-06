
const fetch = require("node-fetch");

const wh_users = require("./wh_users.json");
const secrets  = require("./secrets.json");

function sendWHMessage(content, log = false) {
    let keys = Object.keys(wh_users);
    let user = keys[Math.floor(Math.random() * (keys.length + 1))];
    let avatar = wh_users[user];
    
    console.log(`user: ${user} avatar: ${avatar}`);
    if(!log) {
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
    } else {
        fetch(secrets.logs_webhook, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                content: content,
                avatar_url: "https://dis.quest/icon.png",
                username: "DisQuest logs",
                allowed_mentions: {
                    parse: [],
                },
            }),
        });
    }
}

module.exports = {
    sendWHMessage
}
