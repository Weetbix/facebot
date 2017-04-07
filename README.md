

# Facebot ![image](https://cloud.githubusercontent.com/assets/492636/12047946/c5488f22-af0e-11e5-86f4-f86c185065d8.png)

Facebot is a [Slack](https://slack.com/) bot for facebook messenger integration. It allows you to link slack channels to facebook messenger, and communicate to them through slack.

## Features
- Connect slack channel to a facebook messenger channels
- Messages appear using friends names and profile pictures
- Supports all message types: Images, Stickers, Gifs, Thumbs & Audio messages
- Facebook<-->Slack Emoji support
- Channel links persist between restarts

### Restrictions
- Only 1 facebook account can login and is authorised to use the bot. Multi-user support could be added in the future but facebook-chat-api requires logins to use plaintext email and password, so these are passed and environment variables for a single account.
- For privacy, you can only link completely private slack channels (just you and facebot) to messenger. The person you want to link must be a facebook friend.

# Running the bot

## Run on Heroku for free
You can immediately deploy and start using the bot by clicking the button below:

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/Weetbix/facebot/tree/deploy)

You will need to enter your slack bot API key, facebook details and slack username, and it will begin running on a free heroku instance.

## Downloading
You can download the package from npm with:
```
npm install facebot
```

## Environment Variables

Facebot requires the following environment variables:

Variable|Description
----|-----
`BOT_API_KEY`|The slack bot API key, for the bot user you want to run facebot
`BOT_NAME`|The name of your slack bot
`AUTHORISED_USERNAME`|The slack username for the authorised user. The authorised user should be the owner of the Facebook account. Only the authorised user can interact with Facebot (link channels etc).
`FACEBOOK_EMAIL`|Email address for the Facebook account you want to use
`FACEBOOK_PASSWORD`|Password for the Facebook account you want to use
`DATABASE_URL`|URL for a postgres or mysql database to save and load data from, see details below for format. This reduces the number of sign in messages you may receive by using existing cookies and tokens, and keeps channel links persistent through bot restarts. **If this is not set** the bot will still function, but you will lose channel links between sessions (if not using file based storage).
`DEBUG_MESSAGES`|False by default. Set this to true to receive debug direct messages from Facebot 

### DATABASE_URL
*  For mysql DATABASE_URL should be a json string that will be decoded.  For all possible options see: https://github.com/mysqljs/mysql#connection-options .  An example of a simple block would be: ```'{"host":"localhost","user":"me","password":"secret","database":"my_db"}'```
*  For postgres this should be the the connection string that is given to pg.Client. 

## Running Locally
You can test or run Facebot locally with `node bin/run_local_storage.js`

You will still need to setup the environment variables described above (without `DATABASE_URL`). `run_local_storage.js` will use the local file system to store the login data and any channel links, this is usually not appropriate when running on a PaaS such as Heroku.

# Using the Bot 

## Commands
![image](https://cloud.githubusercontent.com/assets/492636/12048090/387b0914-af11-11e5-95f5-0e2c1233565a.png)

## Linking Chats
To link a slack channel to a Facebook friend, create a new **private channel** and invite Facebot. Then send `@facebot chat FriendNameHere` to link incoming and outgoing messages.

![image](https://cloud.githubusercontent.com/assets/492636/12016755/efcb3046-ad89-11e5-9837-a8b835b07949.png)
