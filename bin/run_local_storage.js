// Runs the bot using the local file system to store
// any settings and channel links

var fs = require('fs');
var Facebot = require('../lib/facebot');

var envVars = [
    'BOT_API_KEY',
    'FACEBOOK_EMAIL',
    'FACEBOOK_PASSWORD',
    'AUTHORISED_USERNAME',
];

envVars.forEach(function(name) {
    if (process.env[name] == null)
        throw new Error('Environment Variable ' + name + ' not set');
});

function load_data(callback) {
    fs.readFile('saved_data.json', function(err, data) {
        if (err) {
            return callback(err);
        }

        try {
            var state = JSON.parse(data);
            return callback(null, state);
        } catch (err) {
            return callback(err);
        }
    });
}

function save_data(data, callback) {
    fs.writeFile('saved_data.json', JSON.stringify(data), callback);
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
