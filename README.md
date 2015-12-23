# facebot

Slackbot for facebook messenger integration. Map facebook friends to channels and communicate to them through slack.

TODO:
- Slack messages parse text smilies into :emojis_like_this:. Replace obvious ones with text (:P becomes :tounge_out_smiley, etc)
- Message on joining a private channel showing instructions 
- Help message
- Message showing active channel links
- when linking, update channel description with something like "Connected with Tom" 
- Keep links persistent (DB?)
- Create facebook-chat-api pull request fixing dup definition in object