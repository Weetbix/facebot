var util = require("util");
var slackbots = require("slackbots");
var async = require("async");
var S = require("string");
var Q = require("q");
var _ = require("underscore")
var facebook = require("facebook-chat-api");
var fbUtil = require("./util");
var emoji = require("js-emoji");

var Facebot = function Constructor(settings){
	this.settings = settings;
	this.settings.name = this.settings.name || "facebot";
	this.user = null;
    this.facebookApi = null;
    
    // array of { slack_channel: string id, fb_thread: string id }
    this.channelLinks = [];
    this.fb_users = {};
    
    emoji.init_env();
	emoji.replace_mode = 'unified';
    emoji.allow_native = true;
};

util.inherits(Facebot, slackbots);

Facebot.prototype.run = function(){
	// Call the slackbots contructor
	Facebot.super_.call(this, this.settings);
	
	this.on('start', this._onStart);
    this.on('message', this._respondToPrivateMessages);
    this.on('message', this._respondToCreateChatMessages);
    this.on('message', this._postSlackMessagesToFB);
    
    this.on('message', this._postGroupJoinedMessage);
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
        api.listen(function (err, fbmessage){ 
            if(!err)
                self._postFBMessagesToSlack(fbmessage);
        });
    });
}

Facebot.prototype._postFBMessagesToSlack = function(fbmessage){
    var self = this;
    
    // Don't process messages that are from ourselves.
    // For now this
    if(fbmessage.senderID === this.facebookApi.getCurrentUserID())
        return;
        
    _.where(this.channelLinks, { fb_thread: fbmessage.threadID.toString() })
    .forEach(function(link){
        
        var message_text = emoji.replace_emoticons_with_colons(fbmessage.body);
        self.postMessage(link.slack_channel,
                         message_text,
                         { username: link.fb_name,
                           icon_url: link.icon });
    });
}

Facebot.prototype._postSlackMessagesToFB = function(message){
    if(this._isChatMessage(message) &&
       !this._isMessageFromFacebot(message))
    {
        var self = this;
        
        _.where(this.channelLinks, { slack_channel: message.channel })
        .forEach(function(link){
            
            // Replace emoji shortnames with their unicode equiv
            var message_text = emoji.replace_colons(message.text);
            self.facebookApi.sendMessage( 
                message_text,
                link.fb_thread,
                function(err, msgInfo)
                {
                    if(err)
                        self.postMessage(link.slack_channel,
                                         "Error sending last message: " + err.message,
                                         { as_user: true });
                });
        });
    }
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
            return fbUtil.findFriendUserByName(self.facebookApi, friendname);
        })
        .then(function(friend){
            self.channelLinks.push({ 
                slack_channel: message.channel,
                fb_thread: friend.id,
                fb_name: friend.name,
                icon: "http://graph.facebook.com/" + friend.id + "/picture?type=square"
            });
            
            return self.postMessage(message.channel, 
                                    "Chat messages between you and " + friend.name + 
                                    " are now synced in this channel.", 
                                    { as_user: true });
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
	   this._isMessageInDirectMessage(message) &&
	   !this._isMessageFromFacebot(message))
	{
        var response;
        
        // List commands for "help"
        if(S(message.text.toLowerCase()).contains('help'))
        {
            response = "`help`: See this text\n" +
                       "`chat <friend name>`: Connect a private channel with a facebook friend";
        }
        // Response to people using chat command in private message
        else if(this._isCreateChatCommand(message))
        {
            response = "This command cannot be used in a direct message, it must be in a private channel.";
        }
        // repond generically
        else 
        {
            response = "Hi. I'm a robot. 1010110.\n" +
                       "I can connect facebook messenger chats to slack channels. " + 
                       "To connect a chat, create a new private channel and invite me. " +
                       "Type `help` for more info";
        }

		this.postMessage(message.channel, response, { as_user: true });
	}
}

Facebot.prototype._postGroupJoinedMessage = function(message){
    if(message.type == "group_joined")
    {
        var requiredUsers = [this.user.id, this.authorised_user.id];
        
        var self = this;
        this._groupUsersOnlyContains(message.channel.id, requiredUsers)
        .then(function(isTruelyPrivate){
           var join_message;
           if(isTruelyPrivate)
           {
               join_message = "To connect a facebook chat type: \n" +
                              "chat `<friend name>`";
           } 
           else
           {
                join_message = "You can only connect private channels where me and you are the only users."   
           }
           
           return self.postMessage(message.channel.id, join_message, { as_user: true });
        });
    }
}

Facebot.prototype._isChatMessage = function(message){
	return message.type === 'message' && Boolean(message.text);	
};

// Messages from non-private messages have channel id starting with C
Facebot.prototype._isMessageInPublicChannel = function(message){
	return typeof message.channel === 'string' &&
		   message.channel[0] === 'C';
};

// Groups have channel IDs starting with G
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
		   message.channel[0] === 'D';
};

Facebot.prototype._isMessageFromFacebot = function(message){
	return message.user === this.user.id || this._isBotMessage(message);
}

Facebot.prototype._isBotMessage = function(message){
    return message.subtype === "bot_message";
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