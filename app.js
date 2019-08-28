import "@babel/runtime/regenerator"
import express from 'express';
import {MongoClient, ObjectID} from 'mongodb';
import bodyParser from "body-parser";
import {Validator, ValidationError} from 'express-json-validator-middleware'
import cookieParser from 'cookie-parser';
import cryptoRandomString from "crypto-random-string";
import schema from './validate_schema'
import {make_user_info_db_in_req, auth_user, auth_admin, special_auth} from './user_auth'

const mongo_url = 'mongodb://localhost:27017';
const mongo_dbname = 'NEUP_fix';

const app = express();
const validator = new Validator({allErrors: true});

const validate = validator.validate;
app.use(bodyParser.json());
app.use(cookieParser(cryptoRandomString({length: 30})));
app.use("/", express.static("client-example"));
console.debug("静态文件服务器已启动");
const client = new MongoClient(mongo_url, {useNewUrlParser: true});
client.connect().then((Client) => {
    const NEUP_fix = Client.db(mongo_dbname);
    const announcement = NEUP_fix.collection("announcement");// 公告表
    const user_info = NEUP_fix.collection("user_info");// 用户信息表
    const appointment = NEUP_fix.collection("appointment");// 所有的预约
    app.use(make_user_info_db_in_req(user_info));// 将用户信息表绑定在请求对象中，方便user_auth调用。
    app.use(function (req, res, next) {
        req.mongoDatabase = NEUP_fix; // 绑定整个数据库方便查询。并不是正式绑定而是临时绑定，所以查询用户用上面那个而并不直接调用这个。。。都是借口2333
        next()
    });
    app.get('/announcement', (req, res) => {
        announcement.find({}).toArray(((error, result) => {
            let pass_result = result.map((single_ann) => {
                return {
                    "annid": single_ann._id,
                    "text": single_ann.text,
                    "image": single_ann.image,
                    "anntime": single_ann.anntime
                }
            });
            res.json(pass_result);
        }))
    });
    // 添加一个公告
    app.post('/announcement', validate({body: schema.announcement_post_body}), ((req, res) => {
        let prepared_announcement = req.body;
        prepared_announcement.anntime = new Date();
        announcement.insertOne(prepared_announcement).catch((reason => {
            throw reason;
        }));
        res.status(200).end();
    }));

    app.delete('/announcement/:annid', auth_admin, (req, res) => {
        announcement.deleteOne({"_id": ObjectID(req.params.annid)}).then((delete_result) => {
            if (delete_result.deletedCount === 1) {
                res.status(200).end("delete successful.");
            } else {
                res.status(404).end("no such announcement.")
            }
        }).catch(reason => {
            throw reason
        });
    });

    app.patch('/announcement/:annid', auth_admin, validate({body: schema.announcement_update_body}), (req, res) => {
        announcement.updateOne({"_id": ObjectID(req.params.annid)}, {$set: req.body}).then((result) => {
            if (result.result.nModified === 1) {
                res.status(200).end("update successful.")
            } else if (result.result.n === 1) {
                res.status(200).end("no update performed");
            } else {
                res.status(404).end('no such announcement')
            }
        })
    });

    app.get('/user/:userid', (req, res) => {
        user_info.findOne({userid: req.query.userid}).then((result) => {
            if (result.length === null) {
                res.status(404).end('no such user.')
            } else {
                let data = {
                    userid: result.userid,
                    name: result.name,
                    avatar: result.avatar,
                    signature: result.signature,
                    first_login: result.first_login,
                    identity: result.identity
                };
                res.json(data);
            }

        })
    });

    app.put('/user/:userid', auth_user, validate({body: schema.userId_put_body}), special_auth.user_info_update, (req, res) => {
        user_info.updateOne({userid: req.params.userid}, {$set: req.body}).then((result) => {
            if (result.result.nModified === 1) {
                res.status(200).end("update successful.")
            } else if (result.result.n === 1) {
                res.status(200).end("no update performed");
            } else {
                res.status(404).end('no such user')
            }
        })
    });

    /* 这个是实验功能。请求该条后，会自动在浏览器留下cookie，可以自主选择登录用户的身份。
    * 用户请求之后就相当于登录了，会获得一个身份，这个身份是加密的session，内容是账号字符串。会保存起来*/
    app.get('/session/:userid', (req, res) => {
        /**@param {{userid:string}} req.params**/
        res.cookie('JSESSIONID', req.params.userid, {signed: true});
        res.status(200).end('experiment login.')
    });

    app.get('/app', validate({query: schema.app_get_query}), (req, res) => {
        /**@param {{JSESSIONID:string}} req.signedCookies  **/
        console.log(Object.keys(req.signedCookies).length);
        console.log(req.headers.cookie);
        appointment.find(req.query).toArray((error, result) => {// TODO: 这里不能仅仅拿掉id就返回给用户。
            let prepared_result = result.map((one_appointment) => {
                return {
                    appid: one_appointment.appid,
                    status: one_appointment.status,
                    userid: one_appointment.history[0].userid,
                    app_make_time: one_appointment.app_make_time,
                    repair: one_appointment.repair,
                    device_type: one_appointment.device_type,
                    device_model: one_appointment.device_model
                }
            });
            res.json(prepared_result);
        })
    });

    app.post('/app', auth_admin, validate({body: schema.app_post_body}), ((req, res) => {
        let insert_data = req.body;
        insert_data.appid = 2; // TODO: 自增运算！这个最好做成数据库操作。实在不行就用最lowb的办法，但可能用不到。
        insert_data.status = "submitted";
        insert_data.app_exec_time = null;
        insert_data.member = null;// submitted状态下，还没有安排维修人员。
        insert_data.history = [{
            status: "submitted",
            userid: req.cookies.JSESSIONID,// 根据cookie解析。
            time: new Date()
        }];
        insert_data.mes_list = [];// 该条预约下的所有留言板数据。
        // 至此，一个预约的所有元数据准备完毕，存入数据库。
        appointment.insertOne(insert_data).then(() => {
            res.status(200).end("insert successful.")
        }).catch((error) => {
            console.error(error)
        })
    }));

    app.get('/app/:appid', auth_user, special_auth.appointment_detail_control, (req, res) => {// 获取一个预约的详细信息。
        appointment.findOne({appid: req.params.appid}).then(result => {
                let full_data = result;
                delete full_data._id;
                delete full_data.mes_list;
                res.json(full_data);
            }
        );
    });

    app.patch('/app/:appid', auth_user, validate({body: schema.app_update_body}), special_auth.appointment_detail_control, (req, res) => {
        // 检查update行为是否合法。不能对一个已经被标为“成功/失败/取消”的目标update
        appointment.find({appid: req.query.appid}).toArray(((error, result) => {
            if (result.length === 0) {
                res.status(404).end("no such appointment");
            }
            // 只有已提交或已接受的记录才可以更新。为了便于理解，我们把状态分为三类“已提交”、“已接受”和“已结束”。状态只能向前更新。
            let current_status = result[0].status;
            let update_status = req.body.status;
            if (current_status !== "submitted" && current_status !== "accepted") {
                res.status(402).end("cannot update a terminated appointment");
            } else if (current_status === "accepted" && update_status === "submitted") {
                res.status(402).end("cannot update a accepted appointment to updated status")
            } else if (current_status === update_status) {
                res.status(402).end("no update provided")
            } else {// 校验成功，可以美琴
                appointment.updateOne({appid: req.query.appid}, {
                    $set: req.body, $push: {
                        history: {
                            status: update_status,
                            userid: "2018XXXX", // 这个userid要和未来的cookie校验一致。
                            time: (new Date())
                        }
                    }
                }).then((result) => {
                    if (result.result.nModified === 1) {
                        res.status(200).end("update successful.")
                    }
                });
            }
        }));
    });

    app.put('/app/:appid', auth_user, validate({body: schema.app_post_body}), special_auth.appointment_detail_control, (req, res) => {
        appointment.find({appid: req.params.appid}).toArray((error, result) => {
            let current_status = result[0].status;
            if (current_status !== "submitted") {
                res.status(402).end("cannot update an accepted or terminated appointment")
            } else {
                appointment.updateOne({appid: req.query.appid}, {$set: req.body}).then((result) => {
                    if (result.result.nModified === 1) {
                        res.status(200).end("update successful.")
                    } else if (result.result.n === 1) {
                        res.status(200).end("no update performed");
                    } else {
                        res.status(404).end('no such appointment')
                    }
                })
            }
        });

    });

    app.delete('/app/:appid', auth_user, validate({body: schema.app_delete_body}), special_auth.appointment_detail_control, (req, res) => {// 本来打算使用text，但是鉴于已经全局上了json body parser，因此就刻意的提交json吧！
        appointment.find({appid: req.params.appid}).toArray(((error, result) => {
            if (result.length === 0) {
                res.status(404).end("no such appointment")
            } else {
                let current_status = result[0].status;
                if (current_status === "successful" || current_status === "failed" || current_status === "canceled") {
                    res.status(402).end("cannot cancel a terminated or canceled appointment");
                } else {
                    appointment.updateOne({appid: req.params.appid}, {
                        $set: {status: "canceled"}, $push: {
                            history: {
                                status: "canceled",
                                userid: req.signedCookies.JSESSIONID, // TODO: 依旧是cookie解析。
                                time: new Date(),
                                reason: req.body.reason // 取消预约的原因
                            }
                        }
                    }).then(() => {
                        res.status(200).end("cancel successful.")
                    })
                }
            }
        }));
    });
    // 留言板。总体来讲，我并不打算把留言嵌入预约中一并存储。每条留言有自己的id，但也很想把留言直接插入预约中。既然是非关系型数据库，就直接插入吧，发挥你的优势，mongo！
    // 把留言直接插入预约之中。
    app.get('/app/:appid/messageboard', (req, res) => {
        appointment.find({appid: req.params.appid}).toArray(((error, result) => {
            if (result.length === 0) {
                res.status(404).end("no such appointment")
            } else {
                let send_message = result[0].mes_list.map((message) => {
                    return {
                        mesid: message.mesid,
                        appid: req.params.appid,
                        userid: message.userid,
                        content_text: message.content_text,
                        content_image: message.content_image,
                        time: message.time
                    }
                });
                res.json(send_message)
            }
        }))
    });

    app.post('/app/:appid/messageboard', validate({body: schema.mes_post_body}), (req, res) => {
        appointment.find({appid: req.params.appid}).toArray(((error, result) => {
            if (result.length === 0) {
                res.status(404).end("no such appointment")
            } else {
                let insert_data = {
                    mesid: 1234, // TODO: 自增自增！
                    userid: "2018XXXX",
                    content_text: req.body.content_text,
                    content_image: req.body.content_image,
                    time: new Date()
                };
                appointment.updateOne({appid: parseInt(req.params.appid)}, {$push: {mes_list: insert_data}}).then((result) => {
                    res.status(200).end("message successful")
                })
            }
        }))
    });

    app.patch('/app/:appid/messageboard/:mesid', validate({body: schema.mes_post_body}), (req, res) => {
        appointment.findOneAndUpdate({appid: parseInt(req.params.appid)},
            {
                $set: {
                    "mes_list.$[first]": req.body
                }
            },
            {
                arrayFilters: [{
                    "first.mesid": req.params.mesid
                }]
            }).then(result => {
            if (result) {
                res.status(200).end("update successful.") // TODO:这里应该有各种错误的应对
            }
        })
    });

    app.delete('/app/:appid/messageboard/:mesid', (req, res) => {
        let appid = parseInt(req.params.appid);
        let mesid = parseInt(req.params.mesid);
        appointment.findOneAndUpdate({appid: appid},
            {
                $pull: {
                    "mes_list": {"mesid": mesid}
                }
            }).then(result => {
            if (result) {
                res.status(200).end("delete successful.")
            }
        })
    });

    app.use((err, req, res, next) => {
        if (err instanceof ValidationError) {
            // At this point you can execute your error handling code
            res.status(400).send('invalid request data.');
            next();
        } else next(err); // pass error on if not a validation error
    });
}).then(() => {
    console.debug("数据库连接成功，服务器已经启动。");
});

app.listen(8080);
