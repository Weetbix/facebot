var Q = require("q");

var Util = module.exports = {
    
    // Returns a user if they are your facebook buddie
    findFriendUserIDByName: function(api, name){
        
        var userID;
        return Q.nfcall(api.getUserID, name)
                .then(function(data){
                    userID = data[0].userID;
                    return Q.nfcall(api.getUserInfo, userID);
                })
                .then(function(userInfoMap)
                {
                    var userInfo = userInfoMap[userID];
                    
                    if(!userInfo.isFriend) throw new Error("User not your friend");
                    
                    return userID;
                });
    }
    
    
};