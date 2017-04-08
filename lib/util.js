var Q = require("q");

function findFriendUserByName(api, name){
    var userID;
    var promise = 
        Q.nfcall(api.getUserID, name)
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
 
    return promise;
}
module.exports = {
    findFriendUserByName: findFriendUserByName
}