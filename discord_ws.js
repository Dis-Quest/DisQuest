
const os        = require("os");
const Discord   = require("discord.js-light");

const client = new Discord.Client({
    ws: {
        intents: ["GUILDS", "GUILD_MESSAGES"],
    },
    disableMentions: "all",
    presence: {
        activity: {
            type: "WATCHING",
            name: "https://dis.quest | use ,help",
        },
        status: "online"
    },
    cacheGuilds: true,
    cacheChannels: false,
    cacheOverwrites: false,
    cacheRoles: false,
    cacheEmojis: false,
    cachePresences: false,
    fetchAllMembers: false
});

const secrets = require("./secrets.json");
const wh_util = require("./wh_util");

const p = require("./package.json");

/**
 * Check if the bot is in a guild or not.
 * @param guild_id {string} the ID of the guild.
 * @return {boolean} true if the bot is in the guild, false otherwise.
 */
function isInGuild(guild_id) {
    return !!client.guilds.cache.get(guild_id)
}

client.on("message", a => {
    if(a.author.bot) return;
    
    let roles = [];
    
    a.member.roles.cache.forEach(r => {
        roles.push(r.id);
    })
    
    let mentions = [];
    
    a.mentions.members.forEach(r => {
        mentions.push({
            id: r.id,
            username: r.user.username,
            discriminator: r.user.discriminator,
            bot: r.user.bot,
            avatar: r.user.avatar
        });
    });
    
    return onMessage(a.content, a.author.id, a.guild.id, roles, mentions, (c) => {
        return a.channel.send(c);
    });
});

client.login(secrets.bot_token);

/**
 * On Discord message.
 * @param content {string} the content of the message.
 * @param author_id {string} the ID of the author.
 * @param guild_id {string} the ID of the guild.
 * @param roles {string[]} the array of roles of the member.
 * @param mentions {[{"id":string,"username":string,"discriminator":string,"bot":boolean,"avatar":string}]} the mentioned members.
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
            return reply(`\nInfo for the DisQuest bot:\n\`\`\`\nServers: ${client.guilds.cache.size}\nMemory:  ${(process.memoryUsage.rss() / 1024 / 1024).toFixed(2)}MB of ${(os.freemem() / 1024 / 1024).toFixed(2)}MB.\nUptime:  ${(process.uptime() / 60).toFixed(2)} minutes or ${(process.uptime() / 60 / 60).toFixed(2)} hours.\n\`\`\`\nDisQuest version ${p.version}.\n\nMade with <3 by AlexIsOK#0384.`);
        }
        case ",eval": {
            if(guild_id === "333949691962195969") {
                wh_util.sendWHMessage("they did the eval command", true);
                return reply("normally i don't reply to `,eval` at all but hi dbl especially you <@205680187394752512> stinky");
            }
            break;
        }
        case ",watch": {
            if(guild_id !== "")
                return;
            
            break;
        }
        case ",clearwatches": {
            break;
        }
        case ",watches": {
            break;
        }
    }
    
    if(content.startsWith(",ban")) {
        if(guild_id !== "858216200798601216")
            return;
        if(!roles.includes("861753257759473666"))
            return;
        
        mentions.forEach((m) => {
            client.channels.fetch("861746837619081236", true, false).then(channel => {
                channel.send(`User ${m.username}#${m.discriminator} (<@${m.id}>) has been banned by <@${author_id}>.`);
            });
            client.guilds.fetch("858216200798601216", true, false).then(g => {
                client.users.fetch(m.id, true, false).then(u => {
                    g.member(u).ban({
                        reason: "Ban command",
                        days: 1,
                    });
                });
            });
        });
    }
}

client.on("guildCreate", args => {
    wh_util.sendWHMessage("Joined a new guild:\n" +
        "ID: " + args.id + "\n" +
        "name: " + args.name + "\n" +
        "owner id: " + args.owner.id, true);
});


module.exports = {
    isInGuild
}
