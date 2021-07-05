
const WebSocket = require("ws");
const os        = require("os");
const fetch     = require("node-fetch");

let ws = new WebSocket("wss://gateway.discord.gg/?v=9&encoding=json");

const secrets = require("./secrets.json");

const p = require("./package.json");

//guild_id: 0
let guilds = {};

/**
 * Check if the bot is in a guild or not.
 * @param guild_id {string} the ID of the guild.
 * @return {boolean} true if the bot is in the guild, false otherwise.
 */
function isInGuild(guild_id) {
    return !!guilds[guild_id]
}

/**
 * On Discord message.
 * @param content {string} the content of the message.
 * @param author_id {string} the ID of the author.
 * @param guild_id {string} the ID of the guild.
 * @param reply {function} the reply.
 */
function onMessage(content, author_id, guild_id, reply) {
    
    if(!content.startsWith(","))
        return;
    
    switch(content) {
        case ",help": {
            return reply("DisQuest bot help:\n```\n,url  - get the DisQuest URL of this server.\n,info - get info on this bot.\n```");
        }
        case ",url": {
            const urls = require("./urls.json");
            const u = urls.guilds[guild_id];
            
            if(u) reply("Your vanity URL is https://dis.quest/" + u);
            else  reply("You do not have a vanity URL for this server.  You can make one here: https://dis.quest/");
            return;
        }
        case ",info": {
            return reply(`\nInfo for the DisQuest bot:\n\`\`\`\nServers: ${Object.keys(guilds).length}\nMemory:  ${(process.memoryUsage.rss() / 1024 / 1024).toFixed(2)}MB of ${(os.freemem() / 1024 / 1024).toFixed(2)}MB.\nUptime:  ${(process.uptime() / 60).toFixed(2)} minutes or ${(process.uptime() / 60 / 60).toFixed(2)} hours.\n\`\`\`\nDisQuest version ${p.version}.\n\nMade with <3 by AlexIsOK#0384.`);
        }
    }
    
}

ws.on("open", () => {
    console.log(`Discord websocket gateway open.`);
});

let session_id;
let seq = null;
let heartbeat_interval;

let resetInterval;

ws.on("close", () => {
    clearInterval(resetInterval);
    console.log(`WebSocket has closed, re-opening...`);
    ws = new WebSocket("https://gateway.discord.gg/?v=9&encoding=json");
    initWS();
});

function initWS() {
    ws.on("message", data => {
        
        try {
            const js = JSON.parse(data);
            
            seq = js.s;
            
            if(js.op === 10) {
                
                console.log(`session: ${session_id}`);
                
                if(session_id) {
                    console.log(`Session resuming.`);
                    
                    return ws.send(JSON.stringify({
                        "op": 6,
                        "d": {
                            "token": secrets.bot_token,
                            "session_id": session_id,
                            "seq": seq,
                        },
                    }));
                }
                
                ws.send(JSON.stringify({
                    "op": 2,
                    "d": {
                        "token": secrets.bot_token,
                        "intents": 513, //guilds and guild messages
                        "properties": {
                            "$os": "linux",
                            "$browser": "disquest",
                            "$device": "disquest"
                        }
                    }
                }));
                
                heartbeat_interval = js.d.heartbeat_interval;
                
                console.log(`Heartbeat interval is ${heartbeat_interval}`);
                
                setTimeout(() => {
                    ws.send(JSON.stringify({
                        "op": 1,
                        "d": null
                    }));
                    
                    resetInterval = setInterval(() => {
                        ws.send(JSON.stringify({
                            "op": 1,
                            "d": seq
                        }));
                    }, heartbeat_interval);
                }, Math.random() * heartbeat_interval);
                
            } else if(js.op === 0) {
                
                if(!js.t)
                    return;
                
                if(js.t === "READY") {
                    session_id = js.d.session_id;
                }
                
                if(js.t === "GUILD_CREATE") {
                    guilds[js.d.id] = 0;
                }
                
                if(js.t === "GUILD_DELETE") {
                    delete guilds[j.d.id];
                }
                
                if(js.t === "MESSAGE_CREATE") {
                    onMessage(js.d.content, js.d.author.id, js.d.guild_id, (content => {
                        fetch(`https://discord.com/api/v9/channels/${js.d.channel_id}/messages`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": "Bot " + secrets.bot_token,
                            },
                            body: JSON.stringify({
                                content: content,
                            }),
                        }).catch(e => {
                            console.error(`Unable to reply to message: ${e}`);
                        });
                    }));
                }
                
            }
            
        } catch(e) {
            console.error(e);
        }
    });
}

initWS();

module.exports = {
    isInGuild
}