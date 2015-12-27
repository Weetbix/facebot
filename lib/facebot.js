var util = require("util");
var slackbots = require("slackbots");
var async = require("async");
var S = require("string");
var Q = require("q");
var _ = require("underscore")
var facebook = require("facebook-chat-api");
var fbUtil = require("./util");
var emoji = require("js-emoji");

// Load_data: function(callback(err, data))
// Save_data: function(data, callback(err))
//    data: { appState: object, channelLinks: [] }
var Facebot = function Constructor(settings, load_data, save_data){
	this.settings = settings;
	this.settings.name = this.settings.name || "facebot";
	this.user = null;
    this.facebookApi = null;
    
    this.load_data = load_data;
    this.save_data = save_data;
    
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
    this.on('message', this._dispatchBotCommands);
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
    
    // Try to load the saved data and login to facebook
    // using the saved credentials. Otherwise fallback
    // to reloggin in with the email and pass
    this._loadData()
    .then(function(data){
       if(self.settings.debug_messages)
            self._DMAuthorisedUser("Loaded data, found " + data.channelLinks.length + " channel links.");
            
        // Load the linked channels
        self.channelLinks = data.channelLinks;

        return self._createFBApi(data);
    })
    .fail(function(err){
        if(self.settings.debug_messages)
            self._DMAuthorisedUser("Couldn't log in with any saved data, logging in with email and pass ("+err+").");
            
        console.log("Couldn't log in with any saved data, logging in with email and pass ("+err+").");
        
        var facebookConfig = {
            email: self.settings.facebook.email, 
            password: self.settings.facebook.pass 
        };
        
        return self._createFBApi(facebookConfig);
    })
    .then(function(){
        self._saveData();
    });
}

Facebot.prototype._loadData = function(){
    var self = this;
    return Q.Promise(function(resolve, reject){
        if(!self.load_data)
            reject(new Error("no load data callback provided"));
        
        self.load_data(function(err, data){
            if(err)
                reject(err);
            
            resolve(data);
        });
    });
}

Facebot.prototype._saveData = function()
{
    if(this.save_data && this.facebookApi){
        var saveData = { appState: this.facebookApi.getAppState(),
                         channelLinks: this.channelLinks };
                         
        this.save_data(saveData, function(err){
            console.log("Error saving facebot data: " + err);
        })
    }
}

Facebot.prototype._createFBApi = function(credentials){
    var self = this;
    return Q.nfcall(facebook, credentials)
           .then(function(api){
               if(self.settings.debug_messages)
                   self._DMAuthorisedUser("Logged into facebook")
               
               self.facebookApi = api;
               api.setOptions({
                  logLevel: "error",
               });
                api.listen(function (err, fbmessage){ 
                    if(!err)
                        self._postFBMessagesToSlack(fbmessage);
                });
           });
}

Facebot.prototype._postFBMessagesToSlack = function(fbmessage){
    var self = this;
        
    _.where(this.channelLinks, { fb_thread: fbmessage.threadID.toString() })
    .forEach(function(link){        
        var message_text = emoji.replace_emoticons_with_colons(fbmessage.body);
        self.postMessage(link.slack_channel,
                         message_text,
                         { username: link.fb_name,
                           icon_url: link.icon });
                           
        // Pass the message on, incase any attachements need to be handled
        self._handleAttachments(fbmessage, link);
    });
}

Facebot.prototype._handleAttachments = function(fbmessage, link){
    self = this;
    fbmessage.attachments.forEach(function(attachment){
        switch(attachment.type)
        {
            case "sticker": self._handleFBImageMessages(attachment.url, link); break;
            case "photo": self._handleFBImageMessages(attachment.hiresUrl, link); break;
            case "animated_image": self._handleFBImageMessages(attachment.rawGifImage, link); break;
            
            // Sharing urls etc. Post the raw URL and let slack do the preview
            case "share":
                self.postMessage(link.slack_channel,
                                 attachment.url,
                                 { username: link.fb_name,
                                 icon_url: link.icon });
                break;
            
            case "file":
                if(S(attachment.name).startsWith("audioclip"))
                    self._handleFBAudioMessages(attachment, link);
                break;
                // Todo: Video                
        }
    });
}

// Posts an image as the facebook user
Facebot.prototype._handleFBImageMessages = function(imgurl, link){
    var attachments = [{ fallback: imgurl, 
                         image_url: imgurl }];
                         
    this.postMessage(link.slack_channel,
                     "",
                     { attachments: attachments,
                       username: link.fb_name,
                       icon_url: link.icon });
}

Facebot.prototype._handleFBAudioMessages = function(attachment, link){
    this.postMessage(link.slack_channel,
                     "<" + attachment.url + "|Voice Message>",
                     { username: link.fb_name,
                       icon_url: link.icon });
}

Facebot.prototype._postSlackMessagesToFB = function(message){
    if(this._isChatMessage(message) &&
       !this._isMessageFromFacebot(message) &&
       !this._isMessageMentioningFacebot(message))
    {
        var self = this;
        
        _.where(this.channelLinks, { slack_channel: message.channel })
        .forEach(function(link){
            
            // Replace emoji shortnames with their unicode equiv
            var message_text = emoji.replace_colons(message.text);
            // Also replace :simple_smile: with :), as it doesnt appear to be 
            // a legit emoji, and will just send :simple_smile: to fb
            message_text = message_text.replace(":simple_smile:", ":)");
            
            self.facebookApi.sendMessage( 
                message_text,
                link.fb_thread,
                function(err, msgInfo){
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
    var self = this;
    var requiredUsers = [this.user.id, this.authorised_user.id];
    
    // Parse the friend name: "@facebot chat captain planet" becomes "captain planet"
    var friendname = message.text.substring(message.text.indexOf("chat") + "chat".length).trim();
    
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
        self._saveData();
        
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

Facebot.prototype._respondToUnlinkCommands = function(message)
{
    var response;
    var matchingChannel = function (link){
        return link.slack_channel === message.channel;
    };
  
    if(_.some(this.channelLinks, matchingChannel)){
        this.channelLinks = _.reject(this.channelLinks, matchingChannel);
        this._saveData();
        response = "This channel is no longer connected to Facebook Messenger";
    } else {
        response = "This channel is not connected to any Facebook friends";
    }
    this.postMessage(message.channel,
                     response,
                     { as_user: true });
}

Facebot.prototype._dispatchBotCommands = function(message){
    if(this._isChatMessage(message) &&
	   !this._isMessageFromFacebot(message))
    {
        var command = "";
        var mention = "<@" + this.user.id + ">";
        if(S(message.text).startsWith(mention)) {
            command = message.text.substring(mention.length + 1);
        } 
        else if(this._isMessageInDirectMessage(message)) {
            command = message.text;
        }
        
        // command should be single words
        command = command.trim().toLowerCase().split(" ", 1)[0];
        if(command) 
            this._respondToCommands(command, message);
    }
}

Facebot.prototype._respondToCommands = function(command, message){
    if(command === "list")
        return this._postListOfLinkedChannels(message);
        
    if(command === "chat")
        return this._respondToCreateChatMessages(message);
    
    if(command == "unlink")
        return this._respondToUnlinkCommands(message);
    
    var response;
    if(command === "help") {        
        response = "`help`: See this text\n" +
                    "`chat <friend name>`: Connect a private channel with a facebook friend\n" +
                    "`unlink`: Disconnects the current channel from facebook messages\n" +
                    "`status`: Show facebook connectivity status\n" +
                    "`list`: Shows information about linked chats\n" + 
                    "_Note: You can send commands without sending facebook messages by mentioning facebot. For example:_\n" +
                    "`@facebot list`: list the linked chats in the current channel";
    }
    else if(command == "status"){
        response = "Facebook is currently *" + (this.facebookApi ? "connected*" : "not connected*");
    }
    else {
        response = "Hi. I'm a robot. 1010110.\n" +
                   "I can connect facebook messenger chats to slack channels. " + 
                   "To connect a chat, create a new private channel and invite me. " +
                   "Type `help` for more info";
    }
    
    this.postMessage(message.channel, response, { as_user: true });
}

Facebot.prototype._respondToPrivateMessages = function(message){
	if(this._isChatMessage(message) &&
	   this._isMessageInDirectMessage(message) &&
	   !this._isMessageFromFacebot(message))
	{
        var response;
        
        if(S(message.text.toLowerCase()).contains('list')){
            return this._postListOfLinkedChannels(message);
        }
        
        // List commands for "help"
        if(S(message.text.toLowerCase()).contains('help')){
            response = "`help`: See this text\n" +
                       "`chat <friend name>`: Connect a private channel with a facebook friend\n" +
                       "`status`: Show facebook connectivity status\n" +
                       "`list`: Shows information about linked chats";
        } else if(S(message.text.toLowerCase()).contains('status')){
            response = "Facebook is currently *" + (this.facebookApi ? "connected*" : "not connected*");
        }
        // Response to people using chat command in private message
        else if(this._isCreateChatCommand(message)){
            response = "This command cannot be used in a direct message, it must be in a private channel.";
        }
        // repond generically
        else {
            response = "Hi. I'm a robot. 1010110.\n" +
                       "I can connect facebook messenger chats to slack channels. " + 
                       "To connect a chat, create a new private channel and invite me. " +
                       "Type `help` for more info";
        }

		this.postMessage(message.channel, response, { as_user: true });
	}
}

Facebot.prototype._postListOfLinkedChannels = function(message)
{
    var self = this;
    if(this.channelLinks.length > 0){
        this.getGroups().then(function(data) {
            // build a description of each link
            var linkDescriptions = self.channelLinks.map(function(link){
                var group = _.find(data.groups, function(group){ 
                    return group.id === link.slack_channel 
                });
                return "*" + group.name + "* is linked with *" + link.fb_name + "*";
            })
            
            return self.postMessage(message.channel, linkDescriptions.join("\n"), { as_user: true });
        });
    } else {
		this.postMessage(message.channel, 
                         "There are currently no facebook chats linked to slack channels.", 
                         { as_user: true });
    }
}

Facebot.prototype._postGroupJoinedMessage = function(message){
    if(message.type == "group_joined"){
        var requiredUsers = [this.user.id, this.authorised_user.id];
        
        var self = this;
        this._groupUsersOnlyContains(message.channel.id, requiredUsers)
        .then(function(isTruelyPrivate){
           var join_message;
           if(isTruelyPrivate){
               join_message = "To connect a facebook chat type: \n" +
                              "chat `<friend name>`";
           } else {
                join_message = "You can only connect private channels where me and you are the only users."   
           }
           
           return self.postMessage(message.channel.id, join_message, { as_user: true });
        });
    }
}

Facebot.prototype._DMAuthorisedUser = function(message){
    this.postMessageToUser(this.settings.authorised_username, message, { as_user: true });
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
    })
    .fail(function(err){
        throw new Error("This is a not group channel.");
    });
}

Facebot.prototype._isMessageInDirectMessage = function(message){
	return typeof message.channel === 'string' &&
		   message.channel[0] === 'D';
};

Facebot.prototype._isMessageFromFacebot = function(message){
	return message.user === this.user.id || this._isBotMessage(message);
}

Facebot.prototype._isMessageMentioningFacebot = function(message){
    var mention = "<@" + this.user.id + ">";
    return message.text.indexOf(mention) > -1;
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

module.exports = Facebot;