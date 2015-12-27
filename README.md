# facebot

Slackbot for facebook messenger integration. Map facebook friends to channels and communicate to them through slack.

Features:
- Connect a private slack channel to a facebook friends messenger
- Messages sent using friends profile picture and Name
- Emoji support
- Supports: Images, Stickers, Gifs, Thumbs & Audio messages

Restrictions:
- Only 1 facebook user can login and is authorised to use the bot at the moment. This could change in the future if it is highly requested.
- For privacy, you can only join completely private slack channels (just you and facebot) to messenger. The person you want to link must be a facebook friend.
- Only supports connecting to users, not group chats. This is a feature that could be added but I have no need for this at the moment.

Todo:
- slack->FB img support
- use selfListen option in facebook-chat-api to relay messages you send directly through facebook, but not slack. Will require some smarts.