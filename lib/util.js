const Q = require('q');

// Regex to test if the string is likely a facebook user ID
const USER_ID_REGEX = /^\d+$/;

async function getFBUserInfoByID(api, id) {
    return await Q.nfcall(api.getUserInfo, id);
}

async function findFBUser(api, search_str, allowNonFriends) {
    let userID = search_str;

    // If the search string isnt a userID, we should search
    // for the user by name
    if (!USER_ID_REGEX.test(search_str)) {
        let userData = await Q.nfcall(api.getUserID, name);
        userID = userData[0].userID;
    }

    const userInfoMap = await getFBUserInfoByID(api, userID);
    const userInfo = userInfoMap[userID];

    if (!userInfo.isFriend && !allowNonFriends)
        throw new Error(
            'User not your friend, they may not be your top ' +
                name +
                ", try using '@facebot friends <partial_name>' to get their id or fb vanity name to use"
        );

    // The userinfo object doesnt have an id with it, so add it as its useful
    userID.id = userID;

    return userInfo;
}

module.exports = {
    findFBUser,
};
