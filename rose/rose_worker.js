
const {Worker} = require("discord-rose");
const os       = require("os");

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
            ctx.reply("DisQuest bot help:\n```\n,url - get the DisQuest URL of this server.\ninfo - get info on this bot.\n```", false);
        }
    }).add({
        command: "reset",
        exec: ctx => {
            if(ctx.author.id === "541763812676861952")
                process.exit(0);
        }
    }).add({
        command: "info",
        exec: ctx => {
            ctx.reply(`\nInfo for the DisQuest bot:\n\`\`\`\nServers: ${ctx.worker.guilds.size}\nMemory:  ${process.memoryUsage.rss() / 1024 / 1024}MB of ${os.freemem() / 1024 / 1024}MB.\nUptime: ${process.uptime() / 60} minutes or ${process.uptime() / 60 / 60} hours.\n\`\`\`\n\nDisQuest version ${require("../package.json").version}.\n\nRunning Discord Rose version ${require("../package.json").dependencies["discord-rose"].replace("^", "")}.\n\nCreated by AlexIsOK#0384.`, false);
        }
});

let l;

const gcl = require("../guild_create_listener");

w.on("GUILD_CREATE", data => {
    console.log(`guild create ${data}`);
    gcl.invoke();
    const secrets = require("../secrets.json");
    fetch(secrets.webhook_url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        content: `Guild create:
\`\`\`
ID: ${data.id}
Name: ${data.name}
Icon: ${data.icon}
Owner: ${data.owner}
\`\`\``
    }).then(r => r.json()).then(r => console.log(`wh r: ${r}`));
});
