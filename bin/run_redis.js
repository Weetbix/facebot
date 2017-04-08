// Runs the bot using redis to store any
// settings and channel links.
//
// This requires:
// the REDIS_URL environment variable to be set.
// the redis node package added (Postgre is the
// prefered storage method so redis is not included)

var Facebot = require('../lib/facebot');
var redis = require('redis');

var envVars = [
    'BOT_API_KEY',
    'FACEBOOK_EMAIL',
    'FACEBOOK_PASSWORD',
    'AUTHORISED_USERNAME',
    'REDIS_URL',
];

envVars.forEach(function(name) {
    if (process.env[name] == null)
        throw new Error('Environment Variable ' + name + ' not set');
});

var client = redis.createClient(process.env.REDIS_URL);
var redisKey = 'facebotdata';

client.on('error', function(err) {
    console.log('Redis error: ' + err);
});

function load_data(callback) {
    if (!client) {
        return callback(new Error('Redis client not created'));
    }
    client.get(redisKey, function(err, reply) {
        if (err) {
            return callback(err, null);
        }

        try {
            var data = JSON.parse(reply);
            return callback(null, data);
        } catch (err) {
            return callback('Got redis key value, but failed to parse: ' + err);
        }
    });
}

function save_data(data, callback) {
    if (!client) {
        return callback(new Error('Redis client not created'));
    }
    client.set(redisKey, JSON.stringify(data), callback);
}

var settings = {
    token: process.env.BOT_API_KEY.trim(),
    name: process.env.BOT_NAME,
    authorised_username: process.env.AUTHORISED_USERNAME,
    debug_messages: process.env.DEBUG_MESSAGES || false,
    facebook: {
        email: process.env.FACEBOOK_EMAIL,
        pass: process.env.FACEBOOK_PASSWORD,
    },
};

var facebot = new Facebot(settings, load_data, save_data);

facebot.run();
