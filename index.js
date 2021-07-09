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
const wh_util        = require("./wh_util");

let token = secrets.bot_token;

//user_id: number
let refreshServerListLimit = {}

wh_util.sendWHMessage("Website is online.");

/**
 * Run this on an interval and it will automatically check invite links.
 */
async function inviteCheckerLoop() {
    
    //check all links
    for(const i of Object.keys(urls.guilds)) {
        
        //if the url exists
        let h = urls.links[urls.guilds[i]];
        if(h) {
            console.log(`Checking invite ${urls.guilds[i]}`);
            
            //wait 0 to 120 seconds before checking to reduce rates
            setTimeout(async() => {
                console.log(`Invite ${urls.guilds[i]} is being checked...`);
                
                //check the individual invite
                const link = await fetch("https://discord.com/api/v9/invites/" + h.href, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bot ${token}`,
                        "Content-Type": "application/json"
                    }
                }).then(r => r.json());
                
                //unknown invite > generate new invite
                if(link.code === 10006) {
                    console.log(`Invalid invite ${urls.guilds[i]}`);
                    let inv = await generateFirstInvite(i);
                    
                    //if the bot could not make a new invite (not in server/no perms) delete the vanity URL.
                    if(inv === "~~" || inv === "" || inv === "~") {
                        console.log(`DELETING url ${urls.guilds[i]} by ${i}`);
                        
                        sendWHMessage(`The URL dis.quest/${urls.guilds[i]} has been deleted as the invite expired and the bot cannot generate a new one.`);
                        
                        const vanity = urls.guilds[i];
                        delete urls.guilds[i];
                        delete urls.links[vanity];
                        url_storage.save(JSON.stringify(urls));
                        return;
                    }
                    
                    //store the new data.
                    urls.links[urls.guilds[i]].href = inv;
                    url_storage.save(JSON.stringify(urls));
                }
                
                console.log(`done with ${urls.guilds[i]}`);
                
            }, Math.random() * 120000);
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
    
    //get the default channel
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
        return "~";
    }
}

//set the first timeout after a minute
setTimeout(inviteCheckerLoop, 60000);

setInterval(inviteCheckerLoop, 3600000);

//start the bot

const discord_ws = require("./discord_ws");

let urls = require("./urls.json");

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


//user: avatar_url
const wh_users = require("./wh_users.json");

/**
 * Called when a DisQuest link is updated
 * @param content {string} the content of the WH message.
 */
function sendWHMessage(content) {
    wh_util.sendWHMessage(content);
}

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

/**
 * Get the session of a user.
 * @param request the request.
 * @returns {string | undefined} the session.
 */
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

/**
 * Check to see if a user is a booster or not.
 * @param userID {string} the ID of the user.
 * @returns {Promise<boolean>} true if the user is a booster, false otherwise.
 */
async function isBooster(userID) {
    
    try {
        
        //fetch user
        const value = (await fetch(`https://discord.com/api/guilds/858216200798601216/members/${userID}`, {
            headers: {
                "Authorization": "Bot " + require("./secrets.json").bot_token,
            },
        }).then(r => r.json()));
        
        //get the roles of the user
        if(value && value.roles) {
            for(let i = 0; i < value.roles.length; i++) {
                const r = value.roles[i];
                
                //if the user has the booster role or the bypass role.
                if(r === "860586604917424129" || r === "860348367036481557")
                    return true;
            }
        }
    } catch(e) {}
    
    return false;
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
    
    //why is discord not using json for this
    let body = [];
    for(let d in data) {
        const key = encodeURIComponent(d), val = encodeURIComponent(data[d]);
        body.push(`${key}=${val}`);
    }
    const sendBody = body.join("&");
    
    //get the bearer token
    let json = await (fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: sendBody
    })).then(res => res.json());
    
    if(!json || !json.access_token || !json.scope) {
        return undefined;
    }
    
    //make sure the user didn't mess with the scopes
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

/**
 * Deliver a static page.
 * @param path {string} the path (such as `./pub/dashboard.html`)
 * @param res {ServerResponse} the response.
 * @param type {string} the MIME type of the content.
 */
function deliverStatic(path, res, type) {
    res.setHeader("Content-Type", type);
    res.writeHead(200);
    return res.end(fs.readFileSync(path));
}

/**
 * Redirect the user.
 * @param url {string} the URL to redirect to.
 * @param res {ServerResponse} the response.
 */
function redirect(url, res) {
    res.setHeader("Location", url);
    res.writeHead(302);
    return res.end("");
}

const server = https.createServer({
    cert: fs.readFileSync("./ssl/cert.pem"),
    key: fs.readFileSync("./ssl/key.pem"),
    maxHeaderSize: 2048,
    minVersion: "TLSv1.3"
}, async (req, res) => {
    try {
        
        console.log(`ip ${req.connection.remoteAddress} (${req.headers["cf-connecting-ip"]}) is connecting`);
        
        if(!req.headers["cf-connecting-ip"]) {
            console.error(`User ${req.connection.remoteAddress} tried connecting directly!`);
            res.writeHead(400);
            return res.end("Bad Request");
        }
        
        let session = getSession(req);
        
        //if the session has expired.
        if(hasSessionExpired(session) || !sessions[session]) {
            delete sessions[session];
            delete sessionBearer[session];
            session = undefined;
        }
        
        console.log(`user ${sessions[session]} is requesting ${req.url}`);
        
        if(req.url === "/") {
            
            if(!session) {
                return deliverStatic("./pub/index_not_logged_in.html", res, "text/html");
            }
            
            res.setHeader("Content-Type", "text/html");
            res.writeHead(200);
            
            //user
            const user = await getUserFromToken(sessionBearer[session]);
            
            //replace info on main page with username
            return res.end(fs.readFileSync("./pub/index_logged_in.html")
                             .toString()
                             .replace("{USER}", `${user.username}#${user.discriminator}`));
            
        } else if(req.url.startsWith("/?code=")) {
            //exchange Discord code for token.
            const code = req.url.substring(7);
            let token = await tradeCode(code);
            
            if(!token) {
                res.writeHead(400);
                return res.end("There was an error processing your login request.");
            }
            
            //generate new session
            const session_token = `${Date.now()}_${uuid.v4()}`;
            
            const user = await getUserFromToken(token);
            
            sessions[session_token] = user.id;
            sessionBearer[session_token] = token;
            
            res.setHeader("Set-Cookie", `session=${session_token}`);
            return redirect("https://dis.quest/dashboard", res);
        } else if(req.url.startsWith("/logout")) {
            
            if(!sessions[session]) {
                res.writeHead(400);
                return res.end("bad request");
            }
            
            delete mutualsCache[sessions[session]];
            delete sessions[session];
            res.setHeader("Set-Cookie", "session=undefined");
            return redirect("https://dis.quest/", res);
            
        } else if(req.url.startsWith("/dashboard")) {
            
            //redirect if invalid session
            if(!session) {
                res.setHeader("Location", "https://dis.quest/login");
                res.writeHead(302);
                return res.end("");
            }
            
            //deliver dashboard
            return deliverStatic("./pub/dashboard.html", res, "text/html");
        } else if(req.url.startsWith("/api/create/")) {
            //create a new DisQuest URL.
            
            //json
            res.setHeader("Content-Type", "application/json");
            
            //deny not logged in.
            if(!session) {
                res.writeHead(401);
                return res.end("Unauthorized");
            }
            
            //url: the URL to claim.  guild: the id of the guild.
            let url, guild;
            
            //if the syntax is incorrect for whatever reason
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
            
            //if the URL is a premium URL and the user is not boosting,
            //stop it here.
            if(url.length <= 3) {
                let isBoosting = await isBooster(sessions[session]);
                console.log(`isboosting: ${isBoosting}`);
                if(!isBoosting) {
                    res.writeHead(402);
                    return res.end(JSON.stringify({
                        "display_message": "You must boost the official server to get a URL that is 1 to 3 characters."
                    }));
                }
            }
            
            //debug
            console.log(`Does ${url} match the regex?  ${url.match(/^[a-z0-9-]{1,64}$/g)}`);
            
            //check if the URL is valid.
            if(!(url.match(/^[a-z0-9-]{1,64}$/g))) {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "The URL only accepts numbers, letters, and hyphens."
                }));
            }
            
            //list of forbidden words the URL cannot start with.
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
                'faq',        'webhook'
            ];
            
            //check if the URL starts with a forbidden word.
            for(const f of forbidden) {
                if(url.startsWith(f)) {
                    res.writeHead(409);
                    return res.end(JSON.stringify({
                        "display_message": "This URL is already claimed :("
                    }));
                }
            }
            
            //if the URL is already claimed.
            if(urls.links[url]) {
                res.writeHead(409);
                return res.end(JSON.stringify({
                    "display_message": "This URL is already claimed :("
                }));
            }
            
            //check to see if the bot is in the guild.
            if(!(await discord_ws.isInGuild(guild))) {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "An error occurred!  If this happens again, please report this."
                }));
            }
            
            //if the mutuals cache doesn't exist for whatever reason
            if(!mutualsCache)
                await getUserGuilds(sessionBearer[session]);
            
            
            let p_guild;
            
            //check to make sure that the guild exists.
            for(let i = 0; i < mutualsCache[sessions[session]].guilds.length; i++) {
                if(mutualsCache[sessions[session]].guilds[i].id === guild) {
                    p_guild = mutualsCache[sessions[session]].guilds[i];
                    break;
                }
            }
            
            //if user has manage server permissions (normally, the server won't show up on
            //their end if they do not have the permissions)
            if(!p_guild || (p_guild.permissions_new & 32) !== 32) {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "An error occurred!  If this happens again, please report this."
                }));
            }
            
            //if the guild is on a cooldown.
            if(cooldowns.includes(guild)) {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "Please wait before switching URLs."
                }))
            }
            
            console.log(`generating ${url} for ${guild}`);
            
            let invite = await generateFirstInvite(guild);
            
            //if the invite is invalid, the bot doesn't have invite perms, or some other error.
            if(!invite || invite === "" || invite === "~~") {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "Uh oh, an error occurred!  Please report this."
                }));
            }
            
            if(invite === "~") {
                res.writeHead(400);
                return res.end(JSON.stringify({
                    "display_message": "Your server does not have a system channel, please temporarily set one to use as an invite generator",
                }));
            }
            
            //delete any previous URL the guild may have had.
            if(urls.guilds[guild]) {
                sendWHMessage(`The URL dis.quest/${urls.guilds[guild]} has been deleted by <@${sessions[session]}>`);
                delete urls.links[urls.guilds[guild]];
                delete urls.guilds[guild];
            }
            
            //write the invite.
            urls.links[url] = {
                href: invite,
                owner: sessions[session],
                uses: 0,
            };
            
            //store the URL and cooldown the guild.
            urls.guilds[guild] = url;
            url_storage.save(JSON.stringify(urls));
            cooldowns.push(guild);
            
            sendWHMessage(`<@${sessions[session]}> has claimed dis.quest/${url}`);
            
            //success!!!
            res.writeHead(200);
            return res.end(JSON.stringify({
                "display_message": `Success!  Your short invite is dis.quest/${url}`,
            }));
            
        } else if(req.url.startsWith("/api/guilds")) {
            
            //if the user is not logged in, decline
            if(!session) {
                res.writeHead(401);
                return res.end("Unauthorized.");
            }
            
            //get the guilds
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);
            
            
            //prefer cached guilds rather than pinging Discord every time.
            let guild_cache;
            let isCached = false;
            
            //if the guilds are cached, load them here.  If it is expired, delete the cache.
            if(mutualsCache[sessions[session]]) {
                if(mutualsCache[sessions[session]].expires > Date.now()) {
                    guild_cache = mutualsCache[sessions[session]].guilds;
                    isCached = true;
                } else {
                    delete mutualsCache[sessions[session]];
                }
            }
            
            let guilds;
            
            //re-get the guilds if they are not cached.
            if(!isCached) {
                guilds = await getUserGuilds(sessionBearer[session]);
                mutualsCache[sessions[session]] = {};
                mutualsCache[sessions[session]].expires = Date.now() + 3600000; //cache for 1 hour
            } else {
                guilds = guild_cache;
            }
            
            //guilds to return
            let returnedGuilds = [];
            
            //add all the mutual guilds to the return.
            for(let i = 0; i < guilds.length; i++) {
                if(!(await discord_ws.isInGuild(guilds[i].id)))
                    continue;
                guilds[i]["hasBot"] = true;
                console.log(`urls: ${guilds[i].id} ${urls.guilds[guilds[i].id]}`);
                guilds[i]["currentLink"] = urls.guilds[guilds[i].id];
                
                returnedGuilds.push(guilds[i]);
            }
            
            //send the user the guilds
            mutualsCache[sessions[session]].guilds = returnedGuilds;
            return res.end(JSON.stringify(returnedGuilds));
            
        } else if(req.url === "/boat") {
            
            //owner only
            if(!session || !sessions[session] || sessions[session] !== "541763812676861952") {
                return redirect("https://www.youtube.com/watch?v=XUhVCoTsBaM", res);
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
            
            //owner only
            if(!session || !sessions[session] || sessions[session] !== "541763812676861952") {
                return redirect("https://www.youtube.com/watch?v=XUhVCoTsBaM", res);
            }
            
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);
            return res.end(JSON.stringify(urls));
            
        } else if(req.url.startsWith("/api/delete/")) {
            
            //owner only
            if(!session || !sessions[session] || sessions[session] !== "541763812676861952") {
                return redirect("https://www.youtube.com/watch?v=XUhVCoTsBaM", res);
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
            //reload the servers
            
            //auth
            if(!session || !sessions[session]) {
                res.writeHead(400);
                return res.end("bad request");
            }
            
            //if the user already refreshed recently.
            if(refreshServerListLimit[sessions[session]]) {
                if(refreshServerListLimit[sessions[session]] > Date.now()) {
                    res.writeHead(429);
                    return res.end("Too many requests.");
                }
            }
            
            delete mutualsCache[sessions[session]];
            
            refreshServerListLimit[sessions[session]] = Date.now() + 60000;
            
            //no need to deliver content.
            res.writeHead(200);
            return res.end("");
        } else if(req.url.startsWith("/sitemap.xml")) return deliverStatic("./pub/sitemap.xml", res, "application/xml");
        else if(req.url.startsWith("/robots.txt")) return deliverStatic("./pub/robots.txt", res, "text/plain");
        else if(req.url.startsWith("/faq")) return deliverStatic("./pub/faq.html", res, "text/html");
        else if(req.url.startsWith("/about")) return redirect("https://dis.quest/faq", res);
        else if(req.url.startsWith("/background.css")) return deliverStatic("./pub/background.css", res, "text/css");
        else if(req.url.startsWith("/privacy")) return deliverStatic("./pub/privacy.html", res, "text/html");
        else if(req.url.startsWith("/icon.png")) return deliverStatic("./pub/dis.quest.png", res, "image/png");
        else if(req.url === "/bot") return redirect("https://discord.com/api/oauth2/authorize?client_id=857884695093706773&permissions=1&redirect_uri=https%3A%2F%2Fdis.quest&scope=bot", res);
        else if(req.url === "/favicon.ico") return deliverStatic("./pub/favicon.ico", res, "image/x-icon");
        else if(req.url === "/dashboard.css") return deliverStatic("./pub/dashboard.css", res, "text/css");
        else if(req.url.startsWith("/contact")) return deliverStatic("./pub/contact.html", res, "text/html");
        else if(req.url.startsWith("/support")) return redirect("https://dis.quest/faq", res);
        else if(req.url.startsWith("/discord")) return redirect("https://discord.alexisok.dev", res);
        else if(req.url.startsWith("/login")) return redirect("https://discord.com/oauth2/authorize?client_id=857884695093706773&redirect_uri=https%3A%2F%2Fdis.quest&response_type=code&scope=identify+guilds", res);
        else if(req.url === "/webhook") {
            //reserved for a later version
        }
        
        //check if the URL is a vanity URL.
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
