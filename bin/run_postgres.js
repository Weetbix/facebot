// Runs the bot using postgres to store any
// settings and channel links.
//
// This requires:
// the DATABASE_URL environment variable to be set.

var Facebot = require('../lib/facebot');
var pg = require('pg');

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

// Load the settings and JSON from postgres
function load_data(callback) {
    var client = new pg.Client(process.env.DATABASE_URL);

    client.connect(function(err) {
        if (err) {
            return callback(
                new Error("Couldn't connect to Postgres db: " + err.message)
            );
        }

        client.query(
            'SELECT settings_json FROM settings WHERE id = 1',
            function(err, result) {
                if (err || result.rows.length == 0) {
                    return callback(new Error('No settings in postgres table'));
                }

                try {
                    client.end();
                    return callback(null, result.rows[0].settings_json);
                } catch (err) {
                    return callback(
                        'Found results in postgres table, but failed to parse: ' +
                            err
                    );
                }
            }
        );
    });
}

function createTableIfNeeded(client, callback) {
    client.query('SELECT * FROM settings LIMIT 1', function(err, result) {
        if (err || result.rows.length == 0) {
            return client.query(
                'CREATE TABLE settings (id INTEGER, settings_json JSON )',
                callback
            );
        } else {
            // table exists
            return callback(null);
        }
    });
}

function save_data(data, callback) {
    var client = new pg.Client(process.env.DATABASE_URL);

    client.connect(function(err) {
        if (err) {
            return callback(
                new Error("Couldn't connect to Postgres db: " + err.message)
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
            var updateQuery = "UPDATE settings SET settings_json='" +
                JSON.stringify(data) +
                "' WHERE id = 1";
            client.query(updateQuery, function(err, result) {
                if (err) {
                    return callback(
                        new Error(
                            "Couldn't create the settings table: " + err.message
                        )
                    );
                }

                // If the update didnt succeed, there was no existing row
                if (result.rowCount == 0) {
                    var insertQuery = "INSERT INTO settings VALUES (1, '" +
                        JSON.stringify(data) +
                        "')";
                    return client.query(insertQuery, function(err, result) {
                        return callback(err);
                    });
                } else {
                    // Successfully saved
                    callback();
                }
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
