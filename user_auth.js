import {Collection} from 'mongodb'

// Geek form stackoverflow TAT
function isEmptyObject(obj) {
    return !Object.keys(obj).length;
}

/*把用户表绑定在请求对象中，作为一个中间件引入。*/
function make_user_info_db_in_req(user_info_db) {
    return function (req, res, next) {
        req.user_info_db = user_info_db;
        next()
    }
}

// 查询用户是否已经存在在表中，返回一个promise对象，传入一个用户的identity属性。如果用户不存在则会返回null
function query_user_identity(userid, user_info_db) {
    return user_info_db.findOne({userid: userid}).then(result => {
        if (result) {
            return result.identity
        } else {
            return null
        }
    })
}

// 当请求登录的用户并不存在于用户总列表中，便向总列表中添加该用户
function insert_to_user_info(userid, user_info_db) {
    return user_info_db.insertOne({
        userid: userid,
        name: "东大学子",// 作为默认的用户名
        avatar: null,
        signature: null,
        first_login: new Date(),
        identity: "user"
    })
}

/*生成校验用户用的中间件。为了检查用户身份，生成器需要传入一个数据库的连接对象。认证等级
* 这个是通用认证中间件，仅仅可以检验用户是否符合要求的最低权限要求。有一些比较特殊的要求比如用户名必须和所请求的某个属性一致，在下面会有。*/
/** @param {{user_info_db:Collection}} req */
let union_auth = {
    // 普通用户即可请求，理论上讲，用户在请求登陆的时候就应该已经判断出是否为新用户，所以不应该在此检验出新用户，因此绝对没有这个逻辑。在校验完成后，将登录用户尊贵的身份信息identity属性添加到res.user_identity中，供后面的请求。
    // user校验完成之后，req应该就已经具有身份user_identity属性了
    user: function (req, res, next) {
        if (isEmptyObject(req.signedCookies)) {
            res.status(401).end("operation needs login")
        } else {
            let userid = req.signedCookies.JSESSIONID;
            if (!userid) {// 如果userid是null或者undefined，可以检测出来
                res.status(405).end("permission denied")
            }
            query_user_identity(userid, req.user_info_db).then(identity => {
                if (!identity) {// 用户不存在，这是一个非常玄学的问题，我们不予考虑
                    console.error("unexpected request caused by identity \"" + identity + "\"")
                }
                req.user_identity = identity; // 给用户请求附带一个“身份”字符串，如“user”，这样就可以在下面的admin里继续处理了。
                next();
            })
        }
    },
    // 管理员首先要是一个普通用户。已经校验完毕了，因此接下来只需要校验用户是否为管理员就可以了。
    /** @param {{user_identity:string}} req */
    /** @param {{user_info_db:Collection}} req */ // 反复提醒自己这个变量叫什么名字2333

    admin: [this.user, function (req, res, next) {
        if (req.user_identity === "admin") {// 没什么好说的，校验成功，可以操作。
            next()
        } else {
            res.status(405).end("permission denied")
        }
    }]
};

// 对于某些特殊的要求，比如只有用户自己或管理员才可以修改自己的身份信息。登录者的身份user_identity必须和所请求的user_id保持一致，这个校验方法就是为了保证这一点的。
