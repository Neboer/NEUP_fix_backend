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
const client = new MongoClient(mongo_url, {useNewUrlParser: true});

client.connect().then((Client) => {
    const NEUP_fix = Client.db(mongo_dbname);
    const announcement = NEUP_fix.collection("announcement");
    const user_info = NEUP_fix.collection("user_info");
    app.get('/announcement', (req, res) => {
        announcement.find({}).toArray(((error, result) => {
            let pass_result = result.map((single_ann) => {
                return {"annid": single_ann._id, "text": single_ann.text, "image": single_ann.image}
            });
            res.json(pass_result);
        }))
    });
    app.post('/announcement', validate({body: schema.announcement_post_body}), ((req, res) => {
        announcement.insertOne(req.body).catch((reason => {
            throw reason;
        }));// TODO: add result judgement.加一个萌萌哒夹击妹抖
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
                res.status(200).end("update successful")
            } else {
                res.status(410).end("target not found")
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
            } else {
                res.status(410).end('no such user')
            }
        })
    });
    // app.get()
    app.use((err, req, res, next) => {
        if (err instanceof ValidationError) {
            // At this point you can execute your error handling code
            res.status(400).send('invalid request data.');
            next();
        } else next(err); // pass error on if not a validation error
    });
});

app.listen(8080);