
//Checks invite links for expired invites.  Generates a new one if the bot has the ability to.

const fetch = require("node-fetch");

const url_storage = require("./url_storage");

let token;

/**
 * Initialize the file with the token.
 * @param bot_token {string} the token of the bot.
 */
function init(bot_token) {
    token = bot_token;
}

/**
 * Run this on an interval and it will automatically check invite links.
 */
async function inviteCheckerLoop() {
    const urls = require("./urls.json");
    
    for(const i of Object.keys(urls.guilds)) {
        let h = urls.links[urls.guilds[i]];
        if(h) {
            console.log(`Checking invite ${urls.guilds[i]}`);
            setTimeout(async() => {
                console.log(`Invite ${urls.guilds[i]} is being checked...`);
                const link = await fetch("https://discord.com/api/v9/invites/" + h.href, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bot ${token}`,
                        "Content-Type": "application/json"
                    }
                }).then(r => r.json());
                
                //unknown invite
                if(link.code === 10006) {
                    console.log(`Invalid invite ${urls.guilds[i]}`);
                    let inv = await generateFirstInvite(i);
                    if(inv === "~~" || inv === "") {
                        console.log(`DELETING url ${urls.guilds[i]} by ${i}`);
                        const vanity = urls.guilds[i];
                        delete urls.guilds[i];
                        delete urls.links[vanity];
                        url_storage.save(JSON.stringify(urls));
                        return;
                    }
                    urls.links[urls.guilds[i]].href = inv;
                    url_storage.save(JSON.stringify(urls));
                }
                
                console.log(`done with ${urls.guilds[i]}`);
                
            }, Math.random() * 120000); //wait 0 to 120 seconds before checking to reduce rates
        }
    }
}

/**
 * Generate the first invite.
 * @param guild_id {string} the ID of the guild.
 * @return {Promise<string>} the invite code.
 */
async function generateFirstInvite(guild_id) {
    console.log(`Generating invite for ${guild_id}`);
    let f = await fetch("https://discord.com/api/v9/guilds/" + guild_id, {
        headers: {
            "Authorization": `Bot ${token}`,
            "Content-Type": "application/json"
        },
    }).then(r => r.json());
    console.log(`Does f have system?  ${f && f.system_channel_id}`);
    if(f && f.system_channel_id) {
        let invite = await fetch("https://discord.com/api/v9/channels/" + f.system_channel_id + "/invites", {
            method: "POST",
            body: JSON.stringify({
                max_age: 0,
                unique: true,
            }),
            headers: {
                "Authorization": `Bot ${token}`,
                "Content-Type": "application/json"
            },
        }).then(r => r.json());
        console.log(`invite: ${JSON.stringify(invite)}`);
        
        if(invite.code === 50013 || invite.message === "Missing Permissions") {
            return "~~";
        }
        
        if(invite && invite.code) {
            return invite.code;
        }
        return "";
    } else {
        return "";
    }
}

module.exports = {
    init, inviteCheckerLoop, generateFirstInvite
}
