
const {Worker} = require("discord-rose");

const w = new Worker()

const fetch = require("node-fetch");

w.setStatus("watching", "https://dis.quest | use ,help");

w.commands
    .prefix(",")
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
            ctx.reply("DisQuest bot help:\n```\n,url - get the DisQuest URL of this server.\n```", false);
        }
    }).add({
        command: "reset",
        exec: ctx => {
            if(ctx.author.id === "541763812676861952")
                process.exit(0);
        }
    }
);

let l;

const gcl = require("../guild_create_listener");

w.on("GUILD_CREATE", data => {
    console.log(`guild create ${data}`);
    gcl.invoke();
    fetch(require("../secrets.json").webhook_url, {
        method: "POST",
        content: `Guild create: 
\`\`\`
ID: ${data.id}
Name: ${data.name}
Icon: ${data.icon}
Owner: ${data.owner}
\`\`\``
    })
});
