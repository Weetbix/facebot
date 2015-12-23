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

var facebot = new Facebot({
	token: token,
	name: name,
    facebook: facebookLogin,
    authorised_username: "john"
});

facebot.run();