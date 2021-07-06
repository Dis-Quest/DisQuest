
const WebSocket = require("ws");
const os        = require("os");
const fetch     = require("node-fetch");

let ws = new WebSocket("wss://gateway.discord.gg/?v=9&encoding=json");

const secrets = require("./secrets.json");
const wh_util = require("./wh_util");

const p = require("./package.json");

//guild_id: 0
let guilds = {};

/**
 * Check if the bot is in a guild or not.
 * @param guild_id {string} the ID of the guild.
 * @return {boolean} true if the bot is in the guild, false otherwise.
 */
function isInGuild(guild_id) {
    return guilds[guild_id] === 0;
}

/**
 * On Discord message.
 * @param content {string} the content of the message.
 * @param author_id {string} the ID of the author.
 * @param guild_id {string} the ID of the guild.
 * @param roles {string[]} the array of roles of the member.
 * @param mentions {[{"id":string,"discriminator":string,"bot":boolean,"avatar":string}]} the mentioned members.
 * @param reply {function} the reply.
 */
function onMessage(content, author_id, guild_id, roles, mentions, reply) {
    
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
        case ",eval": {
            if(guild_id === "333949691962195969") {
                return reply("normally i don't reply to `,eval` at all but hi dbl especially you <@205680187394752512> stinky");
            }
            break;
        }
    }
    
    if(content.startsWith(",ban")) {
        if(guild_id !== "857884695093706773")
            return;
        if(!roles.includes("861753257759473666"))
            return;
        
        mentions.forEach((m) => {
            fetch("https://discord.com/api/v9/channels/861746837619081236/messages", {
                method: "POST",
                headers: {
                    "Authorization": "Bot " + secrets.bot_token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    content: `User ${m.username}#${m.discriminator} (<@${m.id}>) has been banned by <@${author_id}>.`,
                }),
            });
            fetch("https://discord.com/api/v9/guilds/858216200798601216/bans/" + m.id, {
                method: "PUT",
                headers: {
                    "Authorization": "Bot " + secrets.bot_token,
                },
            });
        });
    }
    
    if(content.startsWith(",close")) {
        if(author_id !== "541763812676861952")
            return;
        ws.terminate();
    }
}

ws.on("open", () => {
    console.log(`Discord websocket gateway open.`);
});

let session_id;
let seq = null;
let heartbeat_interval;

let resetInterval;

setTimeout(() => {
    ws.terminate()
}, 3600000);

ws.on("close", () => {
    session_id = undefined;
    seq = null;
    clearInterval(resetInterval);
    setTimeout(() => {
        console.log(`WebSocket has closed, re-opening...`);
        ws = new WebSocket("https://gateway.discord.gg/?v=9&encoding=json");
        initWS();
    }, 1000);
});

function initWS() {
    ws.on("message", data => {
        try {
            const js = JSON.parse(data);
            
            seq = js.s;
            
            if(js.op === 10) {
                
                ws.send(JSON.stringify({
                    "op": 2,
                    "d": {
                        "token": secrets.bot_token,
                        "intents": 513, //guilds and guild messages
                        "properties": {
                            "$os": "linux",
                            "$browser": "disquest",
                            "$device": "disquest"
                        },
                        "presence": {
                            "activities": [{
                                "name": "https://dis.quest | use ,help",
                                "type": 3,
                            }],
                            "status": "online",
                        },
                    },
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
                
                //this doesn't do anything but i'm keeping it here because it looks cool
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
                    //ignore bots
                    if(js.d.author.bot && js.d.author.bot === true)
                        return;
                    
                    onMessage(js.d.content, js.d.author.id, js.d.guild_id, js.d.member.roles, js.d.mentions, (content => {
                        fetch(`https://discord.com/api/v9/channels/${js.d.channel_id}/messages`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": "Bot " + secrets.bot_token,
                            },
                            body: JSON.stringify({
                                content: content,
                                allowed_mentions: {
                                    parse: [],
                                },
                                message_reference: {
                                    "message_id": js.d.id,
                                    "guild_id": js.d.guild_id,
                                },
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

function getWS() {
    return ws;
}

initWS();

module.exports = {
    isInGuild, getWS
}
