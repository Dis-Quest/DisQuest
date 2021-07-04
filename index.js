#!

const oldlog = console.log;

console.log = (msg) => {
    oldlog(`[${new Date().toISOString()}] - ${msg}`);
}

const fetch = require("node-fetch");
const https = require("https");
const uuid  = require("uuid");
const fs    = require("fs");

const secrets = require("./secrets.json");

const url_storage    = require("./url_storage");

let token = secrets.bot_token;

//user_id: number
let refreshServerListLimit = {}

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

setInterval(inviteCheckerLoop, 10800000);

//start the bot
const rose_master = require("./rose/rose_master.js");

let urls = require("./urls.json");

setInterval(() => {
    urls = require("./urls.json");
});

//session_token: discord_id
let sessions = {
    
}

//session_token: bearer_token
let sessionBearer = {
    
}

/**
 * @type string: {
 *         "guilds": string[],
 *         "expires": number
 *     }
 * 
 */
let mutualsCache = {
    
}

/**
 * @type {string[]}
 */
let cooldowns = [];

//clear the cooldowns array every 5 minutes.
setInterval(() => {
    cooldowns = [];
}, 300000); //5 mins

require("./guild_create_listener").addListener(() => {
    console.log(`resetting`);
    mutualsCache = {};
});

/**
 * Check if a session has expired or not.
 * @param session_token {string} the session token.
 */
function hasSessionExpired(session_token) {
    
    if(!session_token)
        return true;
    
    const time = session_token.split("_")[0];
    
    //if token is older than one day
    return time + 86400000 < Date.now();
}

function getSession(request) {
    const l = {};
    const c = request.headers.cookie;
    
    if(c) {
        c.split(';').forEach(c => {
            const parts = c.split('=');
            l[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    }
    
    return l["session"];
}

async function isBooster(userID) {
    
    // if(userID === "541763812676861952")
    //     return true;
    
    try {
        const value = (await fetch(`https://discord.com/api/guilds/858216200798601216/members/${userID}`, {
            headers: {
                "Authorization": "Bot " + require("./secrets.json").bot_token,
            },
        }).then(r => r.json()));
    
        console.log(`value: ${JSON.stringify(value)}`);
        
        if(value && value.roles) {
            for(let i = 0; i < value.roles.length; i++) {
                const r = value.roles[i];
                if(r === "860586604917424129" || r === "860348367036481557")
                    return true;
            }
        }
    } catch(e) {}
    
    return false;
    
}

function howManyURLsDoesThisPersonHave(userID) {
    return urls.users[userID].claimed_urls;
}

/**
 * Trade a code for a Bearer token
 * @return {Promise<string | undefined>} the bearer token, or undefined if it failed.
 */
async function tradeCode(code) {
    const data = {
        "client_id": "857884695093706773",
        "client_secret": secrets.client_secret,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": "https://dis.quest"
    };
    
    let body = [];
    for(let d in data) {
        const key = encodeURIComponent(d), val = encodeURIComponent(data[d]);
        body.push(`${key}=${val}`);
    }
    const sendBody = body.join("&");
    
    let json = await (fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: sendBody
    })).then(res => res.json());
    
    console.log(`json: ${JSON.stringify(json)}`);
    
    if(!json || !json.access_token || !json.scope) {
        return undefined;
    }
    
    if(json.scope !== "identify guilds")
        return undefined;
    
    return json.access_token;
}

/**
 * Get the user ID from a bearer token.
 * @param bearer_token {string} the bearer token.
 * @return {Promise<{
 *     id: string,
 *     username: string,
 *     avatar: string,
 *     discriminator: string,
 *     mfa_enabled: boolean
 * }>} the user information.
 */
async function getUserFromToken(bearer_token) {
    const r = await (fetch("https://discord.com/api/users/@me", {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + bearer_token,
        },
    })).then(r => r.json());
    console.log(`r: ${JSON.stringify(r)}`);
    return r;
}

async function getUserGuilds(bearer_token) {
    return await (fetch("https://discord.com/api/users/@me/guilds", {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + bearer_token,
        },
    })).then(r => r.json());
}

async function populateMutuals(isCached, session, guild_cache) {

    
}

const server = https.createServer({
    cert: fs.readFileSync("./ssl/cert.pem"),
    key: fs.readFileSync("./ssl/key.pem"),
    maxHeaderSize: 2048,
    minVersion: "TLSv1.3"
}, async (req, res) => {
    try {
        
        console.log(`ip ${req.connection.remoteAddress} (${getSession(req)}, ${req.headers["cf-connecting-ip"]}) is connecting`);
        
        if(!req.headers["cf-connecting-ip"]) {
            console.error(`User ${req.connection.remoteAddress} tried connecting directly!`);
            res.writeHead(400);
            return res.end("Bad Request");
        }
        
        let session = getSession(req);
        
        if(hasSessionExpired(session) || !sessions[session]) {
            delete sessions[session];
            delete sessionBearer[session];
            session = undefined;
        }
        
        console.log(`user ${sessions[session]} is requesting ${req.url}`);
        
        if(req.url === "/") {
            
            if(!session) {
                res.setHeader("Content-Type", "text/html");
                res.writeHead(200);
                return res.end(fs.readFileSync("./pub/index_not_logged_in.html"));
            }
            
            res.setHeader("Content-Type", "text/html");
            res.writeHead(200);
            
            const user = await getUserFromToken(sessionBearer[session]);
            
            return res.end(fs.readFileSync("./pub/index_logged_in.html")
                             .toString()
                             .replace("{USER}", `${user.username}#${user.discriminator}`));
            
        } else if(req.url.startsWith("/?code=")) {
            const code = req.url.substring(7);
            let token = await tradeCode(code);
            
            if(!token) {
                res.writeHead(400);
                return res.end("There was an error processing your login request.");
            }
            
            console.log(`token: ${token}`);
            
            const session_token = `${Date.now()}_${uuid.v4()}`;
            
            const user = await getUserFromToken(token);
            
            sessions[session_token] = user.id;
            sessionBearer[session_token] = token;
            
            res.setHeader("Set-Cookie", `session=${session_token}`);
            res.setHeader("Location", "https://dis.quest/dashboard");
            res.writeHead(302);
            return res.end("");
        } else if(req.url.startsWith("/login")) {
            res.setHeader("Location", "https://discord.com/oauth2/authorize?client_id=857884695093706773&redirect_uri=https%3A%2F%2Fdis.quest&response_type=code&scope=identify+guilds");
            res.writeHead(302);
            return res.end("");
        } else if(req.url.startsWith("/logout")) {
            
            if(!sessions[session]) {
                res.writeHead(400);
                return res.end("bad request");
            }
            
            delete mutualsCache[sessions[session]];
            delete sessions[session];
            res.setHeader("Set-Cookie", "session=undefined");
            res.setHeader("Location", "https://dis.quest/");
            res.writeHead(302);
            return res.end("");
        
        } else if(req.url.startsWith("/support")) {
            
        } else if(req.url.startsWith("/discord")) {
            res.setHeader("Location", "https://discord.alexisok.dev");
            res.writeHead(302);
            return res.end("");
        } else if(req.url.startsWith("/dashboard")) {
            
            if(!session) {
                res.setHeader("Location", "https://dis.quest/login");
                res.writeHead(302);
                return res.end("");
            }
            
            res.setHeader("Content-Type", "text/html");
            res.writeHead(200);
            return res.end(fs.readFileSync("./pub/dashboard.html"));
        } else if(req.url.startsWith("/contact")) {
            res.setHeader("Content-Type", "text/html");
            res.writeHead(200);
            return res.end(fs.readFileSync("./pub/contact.html"));
        } else if(req.url.startsWith("/api/create/")) {
            
            res.setHeader("Content-Type", "application/json");
            
            if(!session) {
                res.writeHead(401);
                return res.end("Unauthorized");
            }
            
            let url, guild;
            
            try {
                guild = req.url.split("/")[3];
                url = req.url.split("/")[4];
                
                if(!url || !guild || !guild.match(/[0-9]{15,25}/g)) {
                    throw new Error();
                }
            } catch(e) {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "An error occurred!  If this happens again, please report this."
                }));
            }
            
            if(url.length <= 5) {
                let isBoosting = await isBooster(sessions[session]);
                console.log(`isboosting: ${isBoosting}`);
                if(!isBoosting) {
                    res.writeHead(402);
                    return res.end(JSON.stringify({
                        "display_message": "You must boost the official server to get a URL that is 1 to 5 characters."
                    }));
                }
            }
            
            console.log(`Does ${url} match the regex?  ${url.match(/^[a-z0-9-]{1,64}$/g)}`);
            
            if(!(url.match(/^[a-z0-9-]{1,64}$/g))) {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "The URL only accepts numbers, letters, and hyphens."
                }));
            }
            
            const forbidden = [
                'login',      'logout',
                'support',    'discord',
                'dashboard',  'api',
                'privacy',    'about',
                'icon',       'bot',
                'boat',       'favicon',
                'license',    'dmca',
                'background', 'contact',
                'sitemap',    'robot',
                'faq'
            ];
            
            for(const f of forbidden) {
                if(url.startsWith(f)) {
                    res.writeHead(409);
                    return res.end(JSON.stringify({
                        "display_message": "This URL is already claimed :("
                    }));
                }
            }
            
            if(urls.links[url]) {
                res.writeHead(409);
                return res.end(JSON.stringify({
                    "display_message": "This URL is already claimed :("
                }));
            }
            
            if(!(await rose_master.isInGuild(guild))) {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "An error occurred!  If this happens again, please report this."
                }));
            }
            
            if(!mutualsCache)
                await getUserGuilds(sessionBearer[session]);
            
            console.log(`mutuals: ${JSON.stringify(mutualsCache)}`);
            console.log(`guild: ${guild}`);
            
            //if user has manage server permissions
            
            let p_guild;
            
            for(let i = 0; i < mutualsCache[sessions[session]].guilds.length; i++) {
                if(mutualsCache[sessions[session]].guilds[i].id === guild) {
                    p_guild = mutualsCache[sessions[session]].guilds[i];
                    break;
                }
            }
            
            if(!p_guild || (p_guild.permissions_new & 32) !== 32) {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "An error occurred!  If this happens again, please report this."
                }));
            }
            
            if(cooldowns.includes(guild)) {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "Please wait before switching URLs."
                }))
            }
            
            if(urls.guilds[guild]) {
                delete urls.links[urls.guilds[guild]];
                delete urls.guilds[guild];
            }
            
            console.log(`generating ${url}`);
            
            let invite = await generateFirstInvite(guild);
            
            if(!invite || invite === "" || invite === "~~") {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "Uh oh, an error occurred!  Please report this."
                }));
            }
            
            urls.links[url] = {
                href: invite,
                owner: sessions[session],
                uses: 0,
            };
            
            urls.guilds[guild] = url;
            
            url_storage.save(JSON.stringify(urls));
            
            cooldowns.push(guild);
            
            res.writeHead(200);
            return res.end(JSON.stringify({
                "display_message": `Success!  Your short invite is dis.quest/${url}`,
            }));
            
        } else if(req.url.startsWith("/api/guilds")) {
            
            if(!session) {
                res.writeHead(401);
                return res.end("Unauthorized.");
            }
            
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);
            
            let guild_cache;
            
            let isCached = false;
            
            if(mutualsCache[sessions[session]]) {
                if(mutualsCache[sessions[session]].expires > Date.now()) {
                    guild_cache = mutualsCache[sessions[session]].guilds;
                    isCached = true;
                } else {
                    delete mutualsCache[sessions[session]];
                }
            }
            
            let guilds;
            
            if(!isCached) {
                guilds = await getUserGuilds(sessionBearer[session]);
                mutualsCache[sessions[session]] = {};
                mutualsCache[sessions[session]].expires = Date.now() + 3600000; //1 hour
            } else {
                guilds = guild_cache;
            }
            
            let returnedGuilds = [];
            
            for(let i = 0; i < guilds.length; i++) {
                if(!(await rose_master.isInGuild(guilds[i].id)))
                    continue;
                guilds[i]["hasBot"] = true;
                console.log(`urls: ${guilds[i].id} ${urls.guilds[guilds[i].id]}`);
                guilds[i]["currentLink"] = urls.guilds[guilds[i].id];
                
                returnedGuilds.push(guilds[i]);
            }
            
            mutualsCache[sessions[session]].guilds = returnedGuilds;
            
            return res.end(JSON.stringify(returnedGuilds));
            
        } else if(req.url.startsWith("/about")) {
            
        } else if(req.url.startsWith("/background.css")) {
            res.setHeader("Content-Type", "text/css")
            res.writeHead(200);
            return res.end(fs.readFileSync("./pub/background.css"));
        } else if(req.url.startsWith("/privacy")) {
            res.setHeader("Content-Type", "text/html");
            res.writeHead(200);
            return res.end(fs.readFileSync("./pub/privacy.html"));
        } else if(req.url.startsWith("/icon.png")) {
            res.setHeader("Content-Type", "image/png");
            res.writeHead(200);
            return res.end(fs.readFileSync("./pub/dis.quest.png"));
        } else if(req.url === "/bot") {
            
            // if(sessions[session]) {
            //     delete mutualsCache[sessions[session]];
            // }
            
            res.setHeader("Location", "https://discord.com/api/oauth2/authorize?client_id=857884695093706773&permissions=1&redirect_uri=https%3A%2F%2Fdis.quest&scope=bot");
            res.writeHead(302);
            return res.end("");
        } else if(req.url === "/favicon.ico") {
            res.setHeader("Content-Type", "image/x-icon");
            res.writeHead(200);
            return res.end(fs.readFileSync("./pub/favicon.ico"));
        } else if(req.url === "/dashboard.css") {
            res.setHeader("Content-Type", "text/css");
            res.writeHead(200);
            return res.end(fs.readFileSync("./pub/dashboard.css"));
        } else if(req.url === "/boat") {
            
            if(!session || !sessions[session] || sessions[session] !== "541763812676861952") {
                res.setHeader("Location", "https://www.youtube.com/watch?v=XUhVCoTsBaM");
                res.writeHead(302);
                return res.end("");
            }
            
            let content = fs.readFileSync("./pub/admin.html").toString();
            
            content = content.replace("{RAM}", process.memoryUsage.rss().toString(10));
            content = content.replace("{URLS}", Object.keys(urls.links).length.toString(10));
            content = content.replace("{SESSIONS}", Object.keys(sessions).length.toString(10));
            content = content.replace("{TIME}", Date.now().toString(10));
            
            res.setHeader("Content-Type", "text/html");
            res.writeHead(200);
            return res.end(content);
        } else if(req.url === "/api/all") {
            if(!session || !sessions[session] || sessions[session] !== "541763812676861952") {
                res.setHeader("Location", "https://www.youtube.com/watch?v=XUhVCoTsBaM");
                res.writeHead(302);
                return res.end("");
            }
            
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);
            return res.end(JSON.stringify(urls));
            
        } else if(req.url.startsWith("/api/delete/")) {
            if(!session || !sessions[session] || sessions[session] !== "541763812676861952") {
                res.setHeader("Location", "https://www.youtube.com/watch?v=XUhVCoTsBaM");
                res.writeHead(302);
                return res.end("");
            }
            
            const u = req.url.substring(12);
            
            let g;
            
            for(const guild of Object.keys(urls.guilds)) {
                if(urls.guilds[guild] === u) {
                    console.log(`deleting guild ${guild}`);
                    g = guild;
                    delete urls.guilds[guild];
                    delete urls.links[guild];
                }
            }
            
            res.writeHead(200);
            return res.end("ok: " + g);
        } else if(req.url.startsWith("/api/reload_servers")) {
            
            if(!session || !sessions[session]) {
                res.writeHead(400);
                return res.end("bad request");
            }
            
            if(refreshServerListLimit[sessions[session]]) {
                if(refreshServerListLimit[sessions[session]] > Date.now()) {
                    res.writeHead(429);
                    return res.end("Too many requests.");
                }
            }
            
            delete mutualsCache[sessions[session]];
            
            refreshServerListLimit[sessions[session]] = Date.now() + 60000;
            
            res.writeHead(200);
            return res.end("");
        } else if(req.url.startsWith("/sitemap.xml")) {
            res.setHeader("Content-Type", "application/xml");
            res.writeHead(200);
            return res.end(fs.readFileSync("./pub/sitemap.xml"));
        } else if(req.url.startsWith("/robots.txt")) {
            res.setHeader("Content-Type", "text/plain");
            res.writeHead(200);
            return res.end(fs.readFileSync("./pub/robots.txt"));
        } else if(req.url.startsWith("/faq")) {
            res.setHeader("Content-Type", "text/html");
            res.writeHead(200);
            return res.end(fs.readFileSync("./pub/faq.html"));
        }
        
        if(urls.links[req.url.substring(1)]) {
            
            //analytics
            urls.links[req.url.substring(1)].uses++;
            
            res.setHeader("Location", "https://discord.gg/" + urls.links[req.url.substring(1)].href);
            res.writeHead(302);
            return res.end("");
        }
        
        res.setHeader("Content-Type", "text/html");
        res.writeHead(404);
        return res.end(fs.readFileSync("./pub/404.html"));
    } catch(e) {
        console.error(e);
    }
    
}).listen(443);
