var Q = require("q");

function findFBUser(fb_api, search_str, allowNonFriends){
	var userID;
    var promise;
    if (/^\d+$/.test(search_str)){  //if all numbers assume it is the userid
        userID=search_str;
        promise=Q.nfcall(api.getUserInfo, userID);
    }else{
        promise= getFBUserIDByName(fb_api,search_str)
        		.then( id => {userID=id; return Q.nfcall(api.getUserInfo, id); } );
    }
    promise=promise.then( userInfoMap => {
		var userInfo = userInfoMap[userID];
		if(!userInfo.isFriend && ! allowNonFriends)
			throw new Error("User not your friend, they may not be your top " + name + ", try using '@facebot friends <partial_name>' to get their id or fb vanity name to use");
            
		// The userinfo object doesnt have an id with it, so add it
		userInfo.id = userID;
		return userInfo;
    });
    return promise;
}
function getFBUserIDByName(fb_api, name){
    return Q.nfcall(api.getUserID, name)
           .then( data => { return data[0].userID;});
}

module.exports = {
    findFBUser: findFBUser
}