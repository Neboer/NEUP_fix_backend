import {Collection} from 'mongodb'

// Geek form stackoverflow TAT
function isEmptyObject(obj) {
    return !Object.keys(obj).length;
}

/*把用户表绑定在请求对象中，作为本页所有依赖的最初中间件引入。*/
export function make_user_info_db_in_req(user_info_db) {
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
export function insert_to_user_info(userid, user_info_db) {
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
/** @param {{user_info_db:Collection, signedCookies:string, user_identity:string}} req
 * @param res
 * @param next
 */
// 普通用户即可请求，理论上讲，用户在请求登陆的时候就应该已经判断出是否为新用户，所以不应该在此检验出新用户，因此绝对没有这个逻辑。在校验完成后，将登录用户尊贵的身份信息identity属性添加到res.user_identity中，供后面的请求。
// user校验完成之后，req应该就已经具有身份user_identity属性了。注意其实没有必要在这里加入检测到管理员登录就放行的选项。因为……就算这里放行，下一个中间件还是要经历的。
export function auth_user(req, res, next) {
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
}

// 管理员首先要是一个普通用户。已经校验完毕了，因此接下来只需要校验用户是否为管理员就可以了。
/** @param {{user_identity:string}} req */
/** @param {{user_info_db:Collection}} req */ // 反复提醒自己这个变量叫什么名字2333
export let auth_admin = [auth_user, function (req, res, next) {
    if (req.user_identity === "admin") {// 没什么好说的，校验成功，可以操作。
        next()
    } else {
        res.status(405).end("permission denied")
    }
}];

// 对于某些特殊的要求，比如只有用户自己或管理员才可以修改自己的身份信息。登录者的身份user_identity必须和所请求的user_id保持一致，这个校验方法就是为了保证这一点的。
// 高级检验应该根据api的不同而在应用层进行校验。
/*用户的请求发送到位后，本地首先校验用户是否有请求的基本权限（已登录或管理员），然后把身份信息写入到user_identity中。如果api调用的是管理员中间件，那么强制校验身份为管理员。
* 如果是高级校验，比如只有用户自己和管理员有权限修改某条留言，则在此处编写对应的中间件。*/

export let special_auth = {
    user_info_update: function (req, res, next) {
        if (req.user_identity === 'admin') {// 管理员大哥嚯冰阔落
            next()
        } else {
            if (req.params.userid === req.signedCookies.JSESSIONID) {// 如果请求修改的对象就是请求者自身，则要放行，但是不能在请求中携带权限数据。所以这个校验应该在合理性校验之后进行。
                if (req.body.identity !== undefined) {
                    res.status(405).end("operation not permitted")
                } else {
                    next();
                }
            }
        }
    },
    // 预约细节访问控制中间件，裁决用户是否拥有控制指定预约的权限并决定拒绝还是放行
    appointment_detail_control: function (req, res, next) {
        if (req.user_identity === 'admin') {// 管理员大哥嚯冰阔落
            next()
        } else {
            let appointment = req.mongoDatabase.collection('appointment');
            appointment.findOne({appid: req.params.appid}).then(result => {
                if (result === null) {
                    res.status(404).end('no such appointment')
                } else if (result.history[0].userid !== req.signedCookies.JSESSIONID) {// 不是管理员，主要检查你请求的这条预约是不是你发布的。
                    res.status(405).end('operation not permitted')
                } else {// 好了好了这条预约你有权处置，控制权交出去啦
                    next()
                }
            })
        }
    },
    // 留言板访问控制中间件，裁决用户是否拥有控制指定留言的权限并决定拒绝还是放行
    message_board_control: function (req, res, next) {
        if (req.user_identity === 'admin') {// 管理员大哥嚯冰阔落
            next()
        } else {
            let appointment = req.mongoDatabase.collection('appointment');
            appointment.findOne({appid: req.params.appid}).then(result => {
                if (result === null) {
                    res.status(404).end('no such appointment')
                } else {
                    let message_piece = result.mes_list.find(message => {
                        return message.mesid === req.params.mesid
                    });
                    if (message_piece === undefined) {
                        res.status(404).end('no such message');
                    } else {
                        if (req.signedCookies.JSESSIONID === message_piece.userid) {
                            next();
                        } else {
                            res.status(405).end('operation not permitted');
                        }
                    }
                }
            })
        }
    }
};