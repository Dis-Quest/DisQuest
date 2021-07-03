
const {Master} = require("discord-rose");

const secrets = require("../secrets.json");

const master = new Master("./rose/rose_worker.js", {
    token: secrets.bot_token,
    intents: ["GUILDS", "GUILD_MESSAGES"],
    shards: 1,
    log: () => {}, //no auto-logging
    cache: {
        channels: true,
        guilds: true,
        members: false,
        messages: false,
        self: true,
        roles: true,
        users: false,
        voiceStates: false
    },
});

master.start();

async function isInGuild(guild_id) {
    console.log(`checking guild_id ${guild_id}`);
    try {
        let guild = await master.guildToCluster(guild_id).getGuild(guild_id);
        let a = (`${guild}`);
        console.log(a);
        return !a.startsWith("Error:");
    } catch(e) {
        return false;
    }
}

module.exports = {
    isInGuild
};
