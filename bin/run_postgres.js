// Runs the bot using postgres to store any
// settings and channel links.
//
// This requires:
// the POSTGRES_DB_URL environment variable to be set.

var Facebot = require('../lib/facebot');
var pg = require('pg');

if(process.env.BOT_API_KEY == null)
	throw new Error("BOT_API_KEY not set");
if(process.env.FACEBOOK_EMAIL == null)
    throw new Error("FACEBOOK_EMAIL not set")
if(process.env.FACEBOOK_PASSWORD == null)
    throw new Error("FACEBOOK_PASSWORD not set")
if(process.env.POSTGRES_DB_URL == null)
    throw new Error("POSTGRES_DB_URL not set")
    
var token = process.env.BOT_API_KEY.trim();
var name = process.env.BOT_NAME;
    
var facebookLogin =
{
    email: process.env.FACEBOOK_EMAIL,
    pass: process.env.FACEBOOK_PASSWORD
};

function load_data(callback)
{
    var client = new pg.Client(process.env.POSTGRES_DB_URL);
    
    client.connect(function(err){
        if(err){
            return callback(new Error("Couldn't connect to Postgres db: " + err.message), null);
        }
        
        client.query("SELECT settings_json FROM settings", function(err, result){
            if(err){
               return callback(new Error("Couldn't get settings from postgres: " + err.message), null);
            }
            
            if(result.rows.length == 0)
                return callback(new Error("No settings in postgres table"));
            
            try {
                var data = JSON.parse(result.rows[0]);
                callback(null, data);
                client.end();
            } catch(err){
                callback("Found results in postgres table, but failed to parse: " + err, null);
            }
        });
    });
}

function createTableIfNeeded(client, callback)
{
    client.query("SELECT * FROM settings LIMIT 1", function(err, result){
        if(err || result.rows.length == 0) {
            client.query("CREATE TABLE settings ( settings_json JSON )", 
            function(err, result){
                    return callback(err);
            });
        } else {
            // table exists
            return callback(null);
        }
    });
}

function save_data(data, callback)
{
    var client = new pg.Client(process.env.POSTGRES_DB_URL);
    
    client.connect(function(err){
        if(err){
            return callback(new Error("Couldn't connect to Postgres db: " + err.message), null);
        }
      
        createTableIfNeeded(client, function (err){
            if(err){
                return callback(new Error("Couldn't create the settings table: " + err.message));
            }
            
            var updateOrInsert = "UPDATE settings SET settings_json='" + JSON.stringify(data) + "';" +
                                 "IF found THEN RETURN;" + 
                                 "INSERT INTO settings VALUES '" + JSON.stringify(data) + "'";
            
            // Insert the settings
            client.query(updateOrInsert, 
            function(err, result){
                if(err)
                    return callback(new Error("Couldn't insert the settings into the table: " + err.message));
                
                client.done();
                return callback(null);
            });
        });
    });
}

var facebot = new Facebot({
	token: token,
	name: name,
    facebook: facebookLogin,
    authorised_username: "john",
    debug_messages: true
}, load_data, save_data);

facebot.run();