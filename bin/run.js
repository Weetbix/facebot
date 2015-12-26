var fs = require('fs');
var Facebot = require('../lib/facebot');

if(process.env.BOT_API_KEY == null)
	throw new Error("BOT_API_KEY not set");
	
var token = process.env.BOT_API_KEY.trim();
var name = process.env.BOT_NAME;

var facebookLogin =
{
    email: process.env.FACEBOOK_EMAIL,
    pass: process.env.FACEBOOK_PASSWORD
};

function ldat(callback)
{
    fs.readFile("saved_data.json", function(err, data){
       if(err)
            callback(err, null);
       
       try
       {
          var state = JSON.parse(data); 
          callback(null, state);    
       }
       catch (err)
       {
           callback(err, null);
       }
    });
}

function sdat(data, callback)
{
    fs.writeFile("saved_data.json", JSON.stringify(data), function(err){
       if(err)
            callback(err); 
    });
}

var facebot = new Facebot({
	token: token,
	name: name,
    facebook: facebookLogin,
    authorised_username: "john"
}, ldat, sdat);

facebot.run();