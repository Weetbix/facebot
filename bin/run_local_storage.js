var fs = require('fs');
var Facebot = require('../lib/facebot');

if(process.env.BOT_API_KEY == null)
	throw new Error("BOT_API_KEY not set");
if(process.env.FACEBOOK_EMAIL == null)
    throw new Error("FACEBOOK_EMAIL not set")
if(process.env.FACEBOOK_PASSWORD == null)
    throw new Error("FACEBOOK_PASSWORD not set")
    
var token = process.env.BOT_API_KEY.trim();
var name = process.env.BOT_NAME;
    
var facebookLogin =
{
    email: process.env.FACEBOOK_EMAIL,
    pass: process.env.FACEBOOK_PASSWORD
};

function load_data(callback)
{
    fs.readFile("saved_data.json", function(err, data){
       if(err) return callback(err, null);
       
       try {
          var state = JSON.parse(data); 
          callback(null, state);    
       } catch (err){
           callback(err, null);
       }
    });
}

function save_data(data, callback)
{
    fs.writeFile("saved_data.json", JSON.stringify(data), function(err){
       if(err) return callback(err); 
    });
}

var facebot = new Facebot({
	token: token,
	name: name,
    facebook: facebookLogin,
    authorised_username: "john"
}, load_data, save_data);

facebot.run();