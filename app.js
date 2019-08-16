import "@babel/runtime/regenerator"
import express from 'express';
import {MongoClient, ObjectID} from 'mongodb';
import bodyParser from "body-parser";
import {Validator, ValidationError} from 'express-json-validator-middleware'
import {announcement_post_body, announcement_update_body} from './validate_schema'

const mongo_url = 'mongodb://localhost:27017';
const mongo_dbname = 'NEUP_fix';

const app = express();
const validator = new Validator({allErrors: true});

const validate = validator.validate;
app.use(bodyParser.json());
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
    app.post('/announcement', validate({body: announcement_post_body}), ((req, res) => {
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
    app.patch('/announcement/:annid', validate({body: announcement_update_body}), (req, res) => {
        console.log(req.body);
        announcement.updateOne({"_id": ObjectID(req.params.annid)}, {$set: req.body}).then((result) => {
            console.log(result)
        })
    });
    app.use((err, req, res, next) => {
        console.log(req.body);
        if (err instanceof ValidationError) {
            // At this point you can execute your error handling code
            res.status(400).send('invalid request data.');
            next();
        } else next(err); // pass error on if not a validation error
    });
});

app.listen(8080);