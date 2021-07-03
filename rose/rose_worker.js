
const {Worker} = require("discord-rose");

const w = new Worker()

w.setStatus("watching", "https://dis.quest | use ]help");

w.commands
    .prefix("]")
    .add({
        command: "url",
        exec: ctx => {
            console.log(`command url by ${ctx.author.id} in ${ctx.guild.id}`);
            
            const urls = require("../urls.json");
            const u = urls.guilds[ctx.guild.id];
            
            if(u) ctx.reply("Your vanity URL is https://dis.quest/" + u, false);
            else  ctx.reply("You do not have a vanity URL for this server.  You can make one here: https://dis.quest/", false);
        }
    }).add({
        command: "help",
        exec: ctx => {
            ctx.reply("DisQuest bot help:\n```\ndisquest url - get the DisQuest URL of this server.\n```", false);
        }
    });

let l;

const gcl = require("../guild_create_listener");

w.on("GUILD_CREATE", data => {
    console.log(`guild create ${data}`);
    gcl.invoke();
});
