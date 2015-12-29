var Q = require("q");

var Util = module.exports = {
    
    // Returns a user if they are your facebook buddie
    // api: facebook api
    // name: name of the friend to find
    findFriendUserByName: function(api, name){
        
        var userID;
        return Q.nfcall(api.getUserID, name)
                .then(function(data){
                    userID = data[0].userID;
                    return Q.nfcall(api.getUserInfo, userID);
                })
                .then(function(userInfoMap){
                    var userInfo = userInfoMap[userID];
                    
                    if(!userInfo.isFriend) throw new Error("User not your friend");
                    
                    // The userinfo object doesnt have an id with it, so add it
                    userInfo.id = userID;
                    return userInfo;
                });
    }    
};