# facebot

Slackbot for facebook messenger integration. Map facebook friends to channels and communicate to them through slack.

Features:
- Connect a private slack channel to a facebook friends messenger
- Slack -> FB emoji support

Restrictions:
- Only 1 facebook user can login and is authorised to use the bot at the moment. This could change in the future if it is highly requested.
- For privacy, you can only join completely private slack channels (just you and facebot) to messenger. The person you want to link must be a facebook friend.
- Only supports connecting to users, not group chats. This is a feature that could be added but I have no need for this at the moment.

Todo:
- Parse FB emojis/smilies into slack emojis
- Slack shortname emoji transforms are a bit broken. Some seem to work, but other obvious ones (like `:P`) do not. 
- command to show active channel links
- Keep links persistent (DB?)
- img support
- when bot says chats are now connectd, it should use the name from FB as the name you enter is just a search.
- sticker support? seems unlikely.
- Look into alternatives to emojione library, its way overkill for translating (40mb node module folder?!)
- New login reviews are posted to facebook on every login, even after 'accepting all future' login attemps. Gotta look into this as if it's running on a server restarting constantly it's going to be a killer.