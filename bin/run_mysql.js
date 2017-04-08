// Runs the bot using mysql to store any
// settings and channel links.
//
// This requires:
// the DATABASE_URL environment variable to be set.

var Facebot = require('../lib/facebot');
var mysql = require('mysql');

var envVars = [
    'BOT_API_KEY',
    'FACEBOOK_EMAIL',
    'FACEBOOK_PASSWORD',
    'AUTHORISED_USERNAME',
    'DATABASE_URL',
];

envVars.forEach(function(name) {
    if (process.env[name] == null)
        throw new Error('Environment Variable ' + name + ' not set');
});

// Load the settings and JSON from mysql
function load_data(callback) {
    var client = mysql.createConnection(JSON.parse(process.env.DATABASE_URL));

    client.connect(function(err) {
        if (err) {
            return callback(
                new Error("Couldn't connect to mysql db: " + err.message)
            );
        }

        client.query(
            'SELECT settings_json FROM settings WHERE id = 1',
            function(err, result) {
                if (err || result.length == 0) {
                    return callback(new Error('No settings in mysql table'));
                }

                try {
                    client.end();
                    return callback(null, JSON.parse(result[0].settings_json));
                } catch (err) {
                    return callback(
                        'Found results in mysql table, but failed to parse: ' +
                            err
                    );
                }
            }
        );
    });
}

function createTableIfNeeded(client, callback) {
    client.query('SELECT * FROM settings LIMIT 1', function(err, result) {
        if (err) {
            return client.query(
                'CREATE TABLE settings (id INT, settings_json TEXT, PRIMARY KEY(id) )',
                callback
            );
        } else {
            // table exists
            return callback(null);
        }
    });
}

function save_data(data, callback) {
    var client = mysql.createConnection(JSON.parse(process.env.DATABASE_URL));

    client.connect(function(err) {
        if (err) {
            return callback(
                new Error("Couldn't connect to mysql db: " + err.message)
            );
        }
        createTableIfNeeded(client, function(err) {
            if (err) {
                return callback(
                    new Error(
                        "Couldn't create the settings table: " + err.message
                    )
                );
            }
            var insertQuery = 'INSERT INTO settings(id, settings_json) VALUES (1, ?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)';
            insertQuery = mysql.format(insertQuery, [JSON.stringify(data)]);
            client.query(insertQuery, function(err, result) {
                if (err)
                    return callback(
                        new Error(
                            "Couldn't insert/update settings table: " +
                                err.message
                        )
                    );
                callback();
            });
        });
    });
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
