const SlackBot = require('slackbots');
const Q = require('q');
const _ = require('underscore');
const facebook = require('facebook-chat-api');
const fbUtil = require('./util');
const emoji_lib = require('js-emoji');
const emoji = new emoji_lib.EmojiConvertor();

// Load_data: function(callback(err, data))
// Save_data: function(data, callback(err))
//    data: { appState: object, channelLinks: [] }
class Facebot extends SlackBot {
    constructor(settings, load_data, save_data) {
        settings.name = settings.name || 'facebot';
        // Slackbot settings
        super({
            name: settings.name,
            token: settings.token,
        });

        this.settings = settings;
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

        this.on('start', this.onStart);
        this.on('message', this.dispatchBotCommands);
        this.on('message', this.postSlackMessagesToFB);
        this.on('message', this.postGroupJoinedMessage);

        this.on('close', () => {
            console.log('Websocket closed. Attempting reconnection');
            this.login();
        });

        this.on('error', error => {
            console.error('Error originating from Slackbots: ' + error.message);
        });
    }

    async onStart() {
        await this.setupUsers();
        await this.setupFacebook();

        this.typingLoop(this.channelLinks[0]);

        if (!this.facebookApi) throw new Error('Unable to log into Facebook');
    }

    // Tries to grab the bot user and the authorised (facebook account) user
    async setupUsers() {
        const findUser = async function(username) {
            const user = await this.getUser(username);

            if (_.isEmpty(user)) {
                throw new Error(`User ${username} not found.`);
            }
            return user;
        }.bind(this);

        this.user = await findUser(this.settings.name);
        this.authorised_user = await findUser(
            this.settings.authorised_username
        );
    }

    // Attempts to log into facebook
    async setupFacebook() {
        try {
            // Try to load the saved data and login to facebook
            // using the saved credentials. Otherwise fallback
            // to reloggin in with the email and pass
            const data = await this.loadData();

            this.sendDebugMessage(
                `Loaded data, found ${data.channelLinks.length} channel links.`
            );
            // Load the linked channels
            this.channelLinks = data.channelLinks;
            return await this.createFBApi(data);
        } catch (err) {
            this.sendDebugMessage(
                `Couldn't log in with any saved data, logging in with email and pass (${err})`
            );

            const facebookConfig = {
                email: this.settings.facebook.email,
                password: this.settings.facebook.pass,
            };
            return await this.createFBApi(facebookConfig);
        }
        this.saveData();
    }

    // Loads the facebook tokens and channel links using
    // the load_data callback passed into the constructor
    loadData() {
        return new Promise((resolve, reject) => {
            if (!this.load_data)
                return reject(new Error('no load data callback provided'));

            this.load_data(function(err, data) {
                if (err) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
    }

    // Saves the facebook tokens and channel links using
    // the save_data callback passed into the constructor
    saveData() {
        if (this.save_data && this.facebookApi) {
            const data = {
                appState: this.facebookApi.getAppState(),
                channelLinks: this.channelLinks,
            };
            this.save_data(data, function(err) {
                if (err) console.log('Error saving facebot data: ' + err);
                else console.log('Saved Facebot settings');
            });
        }
    }

    // Creates the FB api using either saved tokens or username
    // and password passed in as credentials
    async createFBApi(credentials) {
        this.facebookApi = await Q.nfcall(facebook, credentials);

        this.sendDebugMessage('Logged into facebook');

        this.facebookApi.setOptions({
            logLevel: 'error',
            listenEvents: true,
        });
        this.facebookApi.listen((err, fbmessage) => {
            if (!err) this.handleFBNotification(fbmessage);
        });
    }

    // loop that will continue to send the is typing indicator to a channel
    // until we hear back they are not typing, or 10 minutes have past
    typingLoop(link) {
        if (
            !link.is_typing ||
            Date.now() / 1000 - link.typing_start_time > 60 * 5 //if they were typing for more than 5 minutes lets assume we missed the typing end event, also mobile devices sometimes don't stay connected to send typing end if they nav away from app
        )
            return;

        this.ws.send(
            JSON.stringify({
                id: 1,
                type: 'typing',
                channel: link.slack_channel,
            })
        );
        setTimeout(() => this.typingLoop(link), 3000);
    }

    handleTypeNotification(fbmessage, link) {
        if (fbmessage.isTyping == link.is_typing) return;
        link.is_typing = fbmessage.isTyping;
        if (link.is_typing) {
            link.typing_start_time = Date.now() / 1000;
            this.typingLoop(link);
        }
    }

    postFBMessageToSlack(fbmessage, link) {
        if (fbmessage.body !== undefined) {
            const message_text = emoji.replace_emoticons_with_colons(
                fbmessage.body
            );
            this.postMessage(link.slack_channel, message_text, {
                username: link.fb_name,
                icon_url: link.icon,
            });
        }
        this.handleFBAttachments(fbmessage, link);
    }

    // Handles any facebook messages/events received, formats them
    // and sends them through to the linked slack channels
    handleFBNotification(fbmessage) {
        // Facebook typing notifications store the thread ID in a different
        // param than normal messages, so first find the threadID
        let threadID = undefined;
        if (fbmessage.type == 'message')
            threadID = fbmessage.threadID.toString();
        if (fbmessage.type == 'typ') threadID = fbmessage.from.toString();

        if (!threadID) return;

        this.channelLinks
            .filter(link => link.fb_thread === threadID)
            .forEach(link => {
                switch (fbmessage.type) {
                    case 'typ':
                        this.handleTypeNotification(fbmessage, link);
                        break;
                    case 'message':
                        this.postFBMessageToSlack(fbmessage, link);
                        break;
                }
            });
    }

    // Handles any facebook messages with attachments (stickers etc)
    handleFBAttachments(fbmessage, link) {
        fbmessage.attachments.forEach(attachment => {
            if (attachment.url === undefined)
                attachment.url = attachment.facebookUrl;

            if (attachment.url && attachment.url.startsWith('/'))
                attachment.url = 'https://www.facebook.com' + attachment.url;

            switch (attachment.type) {
                case 'sticker':
                    this.handleFBImageMessages(attachment.url, link);
                    break;

                case 'photo': {
                    const url = attachment.hiresUrl ||
                        attachment.largePreviewUrl;
                    this.handleFBImageMessages(url, link);
                    break;
                }

                case 'animated_image': {
                    const url = attachment.rawGifImage || attachment.previewUrl;
                    this.handleFBImageMessages(url, link);
                    break;
                }

                // Sharing urls etc. Post the raw URL and let slack do the preview
                case 'share':
                    const title = attachment.title ||
                        attachment.source ||
                        attachment.url;
                    const params = {
                        username: link.fb_name,
                        icon_url: link.icon,
                        attachments: [
                            {
                                image_url: attachment.image,
                                fallback: attachment.image,
                            },
                        ],
                    };
                    this.postMessage(
                        link.slack_channel,
                        `<${attachment.url}|${title}>: ${attachment.description || ''}`,
                        params
                    );
                    break;

                case 'file':
                    if (attachment.name.startsWith('audioclip'))
                        this.handleFBAudioMessages(attachment, link);
                    else
                        this.postMessage(
                            link.slack_channel,
                            `<${attachment.url}|${attachment.name}>`,
                            {
                                username: link.fb_name,
                                icon_url: link.icon,
                            }
                        );
                    break;

                case 'video':
                    this.handleFBVideoMessages(attachment, link);
                    break;
            }
        });
    }

    // Posts an image to the slack channel (in link) as the facebook sender
    handleFBImageMessages(imgurl, link) {
        this.postMessage(link.slack_channel, '', {
            username: link.fb_name,
            icon_url: link.icon,
            attachments: [
                {
                    fallback: imgurl,
                    image_url: imgurl,
                },
            ],
        });
    }

    // Posts an audio message link to the slack channel (in link) as the facebook sender
    handleFBAudioMessages(attachment, link) {
        this.postMessage(
            link.slack_channel,
            `<${attachment.url}|Download Voice Message>`,
            {
                username: link.fb_name,
                icon_url: link.icon,
            }
        );
    }

    // Posts a video link and thumbnail to the slack channel (in link) as the facebook sender
    handleFBVideoMessages(attachment, link) {
        this.postMessage(
            link.slack_channel,
            `<${attachment.url}|Download Video (${attachment.duration} seconds)>`,
            {
                username: link.fb_name,
                icon_url: link.icon,
                // Use the preview image as the attachmentent in slack
                attachments: [
                    {
                        fallback: attachment.previewUrl,
                        image_url: attachment.previewUrl,
                    },
                ],
            }
        );
    }

    // Handles forwarding any slack messages to facebook users
    postSlackMessagesToFB(message) {
        const attachment = message.type === 'message' &&
            message.attachments &&
            message.attachments.length > 0
            ? message.attachments[0]
            : undefined;

        if (
            (this.isChatMessage(message) || attachment) &&
            !this.isMessageFromFacebot(message) &&
            !this.isMessageMentioningFacebot(message)
        ) {
            this.channelLinks
                .filter(link => link.slack_channel === message.channel)
                .forEach(link => {
                    message.text = message.text || '';

                    // Replace emoji shortnames with their unicode equiv
                    // Also replace :simple_smile: with :), as it doesnt appear to be
                    // a legit emoji, and will just send :simple_smile: to fb
                    let message_text = emoji.replace_colons(message.text);
                    message_text = message_text.replace(':simple_smile:', ':)');

                    const msg = {
                        body: message_text,
                    };
                    if (attachment) msg.url = attachment.image_url;

                    const postErrorToSlack = err => {
                        if (err)
                            this.postMessage(
                                link.slack_channel,
                                `Error sending last message: ${err.error}`,
                                { as_user: true }
                            );
                    };

                    // Send the message
                    this.facebookApi.sendMessage(
                        msg,
                        link.fb_thread,
                        postErrorToSlack
                    );
                });
        }
    }

    // Attempts to link a slack channel to a facebook user
    async respondToCreateChatMessages(message) {
        try {
            const allowedUsers = [this.user.id, this.authorised_user.id];
            const isTruelyPrivate = await this.groupUsersOnlyContains(
                message.channel,
                allowedUsers
            );

            if (!isTruelyPrivate)
                throw new Error('The channel should only contain you and me.');

            // Parse the friend name: "@facebot chat captain planet" becomes "captain planet"
            const friendname = message.text
                .substring(message.text.indexOf('chat') + 'chat'.length)
                .trim();
            const friend = await fbUtil.findFBUser(
                this.facebookApi,
                friendname
            );

            this.channelLinks.push({
                slack_channel: message.channel,
                fb_thread: friend.id,
                fb_name: friend.name,
                is_typing: false,
                icon: `http://graph.facebook.com/${friend.id}/picture?type=square`,
            });
            this.saveData();

            return this.postMessage(
                message.channel,
                `Chat messages between you and ${friend.name} are now synced in this channel.`,
                { as_user: true }
            );
        } catch (err) {
            return this.postMessage(
                message.channel,
                `Unable to connect the chat: ${err.error}`,
                { as_user: true }
            );
        }
    }

    // Unlinks the channel from any facebook friends
    respondToUnlinkCommands(message) {
        const previousSize = this.channelLinks.length;
        this.channelLinks = this.channelLinks.filter(
            link => link.slack_channel !== message.channel
        );

        let response;
        if (previousSize === this.channelLinks.length) {
            response = 'This channel is not connected to any Facebook friends';
        } else {
            response = 'This channel is no longer connected to Facebook Messenger';
            this.saveData();
        }
        this.postMessage(message.channel, response, { as_user: true });
    }

    // Scans all slack messages, and if they appear to be a facebot
    // command, gets facebot to run the command
    dispatchBotCommands(message) {
        if (
            this.isChatMessage(message) &&
            !this.isMessageFromFacebot(message) &&
            !this.isBotMessage(message)
        ) {
            let command = '';
            const mention = `<@${this.user.id}>`;
            if (message.text.startsWith(mention)) {
                command = message.text.substring(mention.length + 1);
            } else if (this.isMessageInDirectMessage(message)) {
                command = message.text;
            }

            // command should be single words, so grab the first word
            command = command.trim().toLowerCase().split(' ', 1)[0];
            if (command) this.respondToCommands(command, message);
        }
    }

    // Handles facebot commands
    respondToCommands(command, message) {
        if (command === 'list') return this.postListOfLinkedChannels(message);

        if (command === 'chat')
            return this.respondToCreateChatMessages(message);

        if (command == 'unlink') return this.respondToUnlinkCommands(message);

        if (command == 'friends')
            return this.respondToFriendSearchCommands(message);

        let response;
        if (command === 'help') {
            response = '`@facebot help`: See this text\n' +
                '`@facebot chat <friend name>`: Connect a private channel with a facebook friend\n' +
                '`@facebot unlink`: Disconnects the current channel from facebook messages\n' +
                '`@facebot status`: Show facebook connectivity status\n' +
                '`@facebot list`: Shows information about linked chats\n' +
                "`@facebot friends <name>`: Display friends who's name contains <name> and their id info\n" +
                '_Note: In this Direct Message channel you can send commands without @mentioning facebot. For example:_\n' +
                '`list`: list the linked chats in the current channel';
        } else if (command == 'status') {
            response = 'Facebook is currently *' +
                (this.facebookApi ? 'connected*' : 'not connected*');
        }

        if (response) {
            this.postMessage(message.channel, response, { as_user: true });
        }
    }
    // search a user for a specific friend and show them the matching friends details
    async respondToFriendSearchCommands(message) {
        const search_str = message.text
            .substring(message.text.indexOf('friends') + 'friends'.length)
            .trim()
            .toLowerCase();

        const friends = await Q.nfcall(this.facebookApi.getFriendsList);

        const response = friends
            .filter(friend => {
                return friend.isFriend &&
                    friend.fullName.toLowerCase().includes(search_str);
            })
            .map(friend => {
                return `${friend.fullName} *vanity:* ${friend.vanity} *userID:* ${friend.userID}`;
            })
            .join('\n');

        this.postMessage(message.channel, response, {
            as_user: true,
        });
    }

    // Posts a list of the currently linked chats, to the channel the
    // message came from
    async postListOfLinkedChannels(message) {
        if (this.channelLinks.length > 0) {
            const groups = (await this.getGroups()).groups;

            // build a description of each link
            const linkDescriptions = this.channelLinks
                .map(link => {
                    const group = groups.find(
                        group => group.id === link.slack_channel
                    );
                    return `*${group.name}* is linked with *${link.fb_name}*`;
                })
                .join('\n');

            this.postMessage(message.channel, linkDescriptions, {
                as_user: true,
            });
        } else {
            this.postMessage(
                message.channel,
                'There are currently no facebook chats linked to slack channels.',
                { as_user: true }
            );
        }
    }

    // Posts a message when facebot is added to any groups, to inform
    // the user how to connect the channel to a facebook friend
    async postGroupJoinedMessage(message) {
        if (message.type == 'group_joined') {
            const allowedUsers = [this.user.id, this.authorised_user.id];
            const isTruelyPrivate = await this.groupUsersOnlyContains(
                message.channel.id,
                allowedUsers
            );

            let join_message = 'To connect a facebook chat type: \n' +
                '@facebot chat `<friend name>`';
            if (!isTruelyPrivate) {
                join_message = 'You can only connect private channels where me and you are the only users.';
            }

            this.postMessage(message.channel.id, join_message, {
                as_user: true,
            });
        }
    }

    // Sends a (slack) direct message to the authorised user if
    // debug messages are enabled
    sendDebugMessage(message) {
        if (this.settings.debug_messages) {
            this.postMessageToUser(this.settings.authorised_username, message, {
                as_user: true,
            });
        }
    }

    isChatMessage(message) {
        return message.type === 'message' && Boolean(message.text);
    }

    // Retruns true if the channel with the id only
    // contains the users in userids
    // users: array of userids
    async groupUsersOnlyContains(channelid, userids) {
        try {
            groupInfo = await this._api('groups.info', { channel: channelid });
            return _.isEmpty(_.difference(groupInfo.group.members, userids));
        } catch (err) {
            throw new Error('This is a not group channel.');
        }
    }

    isMessageInDirectMessage(message) {
        return typeof message.channel === 'string' &&
            message.channel[0] === 'D';
    }

    isMessageFromFacebot(message) {
        return message.user === this.user.id || this.isBotMessage(message);
    }

    isMessageMentioningFacebot(message) {
        const mention = `<@${this.user.id}>`;
        return message.text.indexOf(mention) > -1;
    }

    isBotMessage(message) {
        return message.subtype === 'bot_message';
    }

    isFromAuthorisedUser(message) {
        return message.user === this.authorised_user.id;
    }
}

module.exports = Facebot;
