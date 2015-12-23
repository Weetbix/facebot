var util = require("util");
var slackbots = require("slackbots");
var async = require("async");
var S = require("string");
var Q = require("q");
var _ = require("underscore")
var facebook = require("facebook-chat-api");
var fbUtil = require("./util");

var Facebot = function Constructor(settings){
	this.settings = settings;
	this.settings.name = this.settings.name || "facebot";
	this.user = null;
    this.facebookApi = null;
};

util.inherits(Facebot, slackbots);

Facebot.prototype.run = function(){
	// Call the slackbots contructor
	Facebot.super_.call(this, this.settings);
	
	this.on('start', this._onStart);
    this.on('message', this._respondToCreateChatMessages);
};

Facebot.prototype._onStart = function(){
	this._setupUsers();
    this._setupFacebook();
};

Facebot.prototype._setupUsers = function(){
	// Get the list of users and find ourselves in it
	var self = this;
	
	async.map([self.settings.name, self.settings.authorised_username],
			  function(item, callback){
				  self.getUser(item).then(function(user){
					  return callback(null, user);
				  });
			  },
			  function(err, results){
				  if(err)
				  	return console.log("Couldnt grab a user: " + err);
				
				  self.user = results[0];
				  self.authorised_user = results[1];	
			  });
};

Facebot.prototype._setupFacebook = function(){
    var self = this;
    var facebookConfig = {email: self.settings.facebook.email, password: self.settings.facebook.pass};
    facebook(facebookConfig, function(err, api) {
        if(err) return console.log("Error logging in to facebook: " + err);
        
        self.facebookApi = api;
    });
}

Facebot.prototype._respondToCreateChatMessages = function(message)
{
    if(this._isChatMessage(message) &&
	   this._isMessageInPrivateChannel(message) &&
       this._isCreateChatCommand(message) &&
	   !this._isMessageFromFacebot(message))
	{
        var self = this;
        var requiredUsers = [this.user.id, this.authorised_user.id];
        var friendname = message.text.substring("chat".length);
        
        this._groupUsersOnlyContains(message.channel, requiredUsers)
        .then(function(isTruelyPrivate){
            if(!isTruelyPrivate)
                throw new Error("The channel should only contain you and me.");
        })
        .then(function(){
            return fbUtil.findFriendUserIDByName(self.facebookApi, friendname);
        })
        .then(function(friendid){
            self.facebookApi.sendMessage("Test message from app #1010101", 
                                friendid);
        })
        .fail(function(err){
            return self.postMessage(message.channel,
                                    "Unable to connect the chat. " + err.message,
                                    { as_user: true });
        });
    }
}

Facebot.prototype._respondToPrivateMessages = function(message){
	if(this._isChatMessage(message) &&
	   this._isMessageInPrivateChannel(message) &&
	   !this._isMessageFromFacebot(message))
	{
     
		var response = "Hi. I'm a robot. 1010110.\n" +
					   "I don't do much at the moment but you can tinker with my circuit boards on <https://github.com/Weetbix/Facebot|GitHub>\n" +
					   "Type \"Facebot help\" to peek at my fuse box";
					   
		this.postMessage(message.channel, response, { as_user: true });
	}
}


Facebot.prototype._createChatForFriend = function(channelid, friendid)
{
    return fbUtil.findFriendUserIDByName(self.facebookApi, friendname)
        .then(function(userID){
            self.facebookApi.sendMessage("Test message from app #1010101", 
                                         userID);
        });
}

Facebot.prototype._isChatMessage = function(message){
	return message.type === 'message' && Boolean(message.text);	
};

// Messages from non-private messages have channel id starting with C
Facebot.prototype._isMessageInPublicChannel = function(message){
	return typeof message.channel === 'string' &&
		   message.channel[0] === 'C';
};

// Groups have channel IDs starting with U
Facebot.prototype._isMessageInPrivateChannel = function(message){
	return typeof message.channel === 'string' &&
		   message.channel[0] === 'G';
};

// Resolves a true promise if the channel with the id
// users: array of userids
Facebot.prototype._groupUsersOnlyContains = function(channelid, userids){
    return this._api("groups.info", { channel: channelid } )
    .then(function(groupInfo){
        return _.isEmpty(_.difference(groupInfo.group.members, userids));
    });
}

Facebot.prototype._isMessageInDirectMessage = function(message){
	return typeof message.channel === 'string' &&
		   message.channel[0] === 'G';
};

Facebot.prototype._isMessageFromFacebot = function(message){
	return message.user === this.user.id;
}

Facebot.prototype._isFromAuthorisedUser = function(message){
	return message.user === this.authorised_user.id;
};

Facebot.prototype._isCreateChatCommand = function(message){
    return S(message.text.toLowerCase()).startsWith("chat");
}

// Tom Jones becomes tom-jones
Facebot.prototype._tranformFriendNameToGroupName = function(friendName){
    return friendName.trim().toLowerCase().replace(/\s/g , "-");
}

module.exports = Facebot;