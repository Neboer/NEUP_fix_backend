import "@babel/runtime/regenerator"
import express from 'express';
import {MongoClient, ObjectID} from 'mongodb';
import bodyParser from "body-parser";
import {Validator, ValidationError} from 'express-json-validator-middleware'
import schema from './validate_schema'

const mongo_url = 'mongodb://localhost:27017';
const mongo_dbname = 'NEUP_fix';

const app = express();
const validator = new Validator({allErrors: true});

const validate = validator.validate;
app.use(bodyParser.json());
app.use("/", express.static("client-example"));
console.debug("静态文件服务器已启动");
const client = new MongoClient(mongo_url, {useNewUrlParser: true});
client.connect().then((Client) => {
    const NEUP_fix = Client.db(mongo_dbname);
    const announcement = NEUP_fix.collection("announcement");// 公告表
    const user_info = NEUP_fix.collection("user_info");// 用户信息表
    const appointment = NEUP_fix.collection("appointment");// 所有的预约
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
    app.delete('/announcement/:annid', (req, res) => {
        announcement.deleteOne({"_id": ObjectID(req.params.annid)}).then((delete_result) => {
            if (delete_result.deletedCount === 1) {
                res.status(200).end("delete successful.");
            } else {
                res.status(410).end("no such announcement.")
            }
        }).catch(reason => {
            throw reason
        });
    });
    app.patch('/announcement/:annid', validate({body: schema.announcement_update_body}), (req, res) => {
        announcement.updateOne({"_id": ObjectID(req.params.annid)}, {$set: req.body}).then((result) => {
            if (result.result.nModified === 1) {
                res.status(200).end("update successful.")
            } else if (result.result.n === 1) {
                res.status(200).end("no update performed");
            } else {
                res.status(410).end('no such announcement')
            }
        })
    });

    app.get('/user', validate({query: schema.userId_get_query}), (req, res) => {
        user_info.find({userid: req.query.userid}).toArray((error, result) => {
            if (result.length === 0) {
                res.status(410).end('no such user.')
            } else {
                let data_wait_for_send = [];
                for (let item of result) {
                    data_wait_for_send.push({
                        userid: item.userid,
                        name: item.name,
                        avatar: item.avatar,
                        signature: item.signature
                    })
                }
                res.json(data_wait_for_send);
            }

        })
    });
    app.put('/user', validate({query: schema.userId_get_query, body: schema.userId_put_body}), (req, res) => {
        user_info.updateOne({userid: req.query.userid}, {$set: req.body}).then((result) => {
            if (result.result.nModified === 1) {
                res.status(200).end("update successful.")
            } else if (result.result.n === 1) {
                res.status(200).end("no update performed");
            } else {
                res.status(410).end('no such user')
            }
        })
    });
    app.get('/app', validate({query: schema.app_get_query}), (req, res) => {
        appointment.find(req.query).toArray((error, result) => {// TODO: 这里不能仅仅拿掉id就返回给用户。
            let prepared_result = result.map((one_appointment) => {
                return {
                    appid: one_appointment.appid,
                    status: one_appointment.status,
                    userid: one_appointment.userid,
                    app_make_time: one_appointment.app_make_time,
                    repair: one_appointment.repair,
                    device_type: one_appointment.device_type,
                    device_model: one_appointment.device_model
                }
            });
            res.json(prepared_result);
        })
    });

    app.post('/app', validate({body: schema.app_post_body}), ((req, res) => {
        let insert_data = req.body;
        insert_data.appid = 2; // 自增运算！
        insert_data.status = "submitted";
        insert_data.app_exec_time = null;
        insert_data.member = null;// submitted状态下，还没有安排维修人员。
        insert_data.history = [{
            status: "submitted",
            userid: "2018XXXX",
            time: new Date()
        }];
        insert_data.mesid_list = [];// 留言板id列表。这个作用非常明确，绑定每个预约和对应的留言板id。留言板不用一并发送给客户端，客户端需要访问/
        // 至此，一个预约的所有元数据准备完毕，存入数据库。
        appointment.insertOne(insert_data).then(() => {
            res.status(200).end("insert successful.")
        }).catch((error) => {
            console.error(error)
        })
    }));

    app.get('/app/:appid', (req, res) => {// 获取一个预约的详细信息。
        appointment.find({appid: req.params.appid}).toArray(((error, result) => {
            let full_data = result[0];
            delete full_data._id;
            delete full_data.mesid_list;
            res.json(full_data);
        }))
    });

    app.patch('/app/:appid', validate({body: schema.app_update_body}), (req, res) => {
        // 检查update行为是否合法。不能对一个已经被标为“成功/失败/取消”的目标update
        appointment.find({appid: req.query.appid}).toArray(((error, result) => {
            if (result.length === 0) {
                res.status(410).end("no such appointment");
            }
            // 只有已提交或已接受的记录才可以更新。为了便于理解，我们把状态分为三类“已提交”、“已接受”和“已结束”。状态只能向前更新。
            if (result[0].status)
            if (result[0].status !== "submitted" && result[0].status !== "accepted") {
                res.status(402).end("cannot update a terminated appointment");
            }
            if (result[0].status === "accepted")
        }));
        appointment.updateOne({appid: req.query.appid}, {$set: req.body}).then((result) => {
            if (result.result.nModified === 1) {
                res.status(200).end("update successful.")
            } else if (result.result.n === 1) {
                res.status(200).end("no update performed");
            }
        });
    });

    app.put('/app/:appid', validate({body: schema.app_post_body}), (req, res) => {
        appointment.updateOne({appid: req.query.appid}, {$set: req.body}).then((result) => {
            if (result.result.nModified === 1) {
                res.status(200).end("update successful.")
            } else if (result.result.n === 1) {
                res.status(200).end("no update performed");
            } else {
                res.status(410).end('no such appointment')
            }
        })
    });

    app.delete('/app/:appid', (req, res) => {
        appointment.updateOne({appid: req.query.appid}, {
            $set: {}
        })
    })
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
