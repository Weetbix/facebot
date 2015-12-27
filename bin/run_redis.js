var Facebot = require('../lib/facebot');
var redis = require('redis');

if(process.env.BOT_API_KEY == null)
	throw new Error("BOT_API_KEY not set");
if(process.env.FACEBOOK_EMAIL == null)
    throw new Error("FACEBOOK_EMAIL not set")
if(process.env.FACEBOOK_PASSWORD == null)
    throw new Error("FACEBOOK_PASSWORD not set")
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
    authorised_username: "john",
    debug_messages: true
}, load_data, save_data);

facebot.run();