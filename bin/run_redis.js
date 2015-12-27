// Runs the bot using redis to store any
// settings and channel links.
//
// This requires:
// the REDIS_URL environment variable to be set.
// the redis node package added (Postgre is the
// prefered storage method so redis is not included)

var Facebot = require('../lib/facebot');
var redis = require('redis');

if(process.env.BOT_API_KEY == null)
	throw new Error("BOT_API_KEY not set");
if(process.env.FACEBOOK_EMAIL == null)
    throw new Error("FACEBOOK_EMAIL not set")
if(process.env.FACEBOOK_PASSWORD == null)
    throw new Error("FACEBOOK_PASSWORD not set")
if(process.env.AUTHORISED_USERNAME == null)
    throw new Error("AUTHORISED_USERNAME not set");
if(process.env.REDIS_URL == null)
    throw new Error("REDIS_URL not set")
    
var token = process.env.BOT_API_KEY.trim();
var name = process.env.BOT_NAME;
    
var facebookLogin =
{
    email: process.env.FACEBOOK_EMAIL,
    pass: process.env.FACEBOOK_PASSWORD
};

var client = redis.createClient(process.env.REDIS_URL);
var redisKey = "facebotdata";

client.on("error", function(err){
    console.log("Redis error: " + err);
});

function load_data(callback)
{
    if(!client) return callback(new Error("Redis client not created"), null);
    
    client.get(redisKey, function(err, reply){
        if(err) return callback(err, null);
        
        try {
            var data = JSON.parse(reply);
            callback(null, data);
        } catch(err){
            callback("Got redis key value, but failed to parse: " + err, null);
        }
    })
}

function save_data(data, callback)
{
    if(!client) return callback(new Error("Redis client not created"));
    
    client.set(redisKey, JSON.stringify(data));
}

var facebot = new Facebot({
	token: token,
	name: name,
    facebook: facebookLogin,
    authorised_username: process.env.AUTHORISED_USERNAME,
    debug_messages: process.env.DEBUG_MESSAGES || false
}, load_data, save_data);

facebot.run();