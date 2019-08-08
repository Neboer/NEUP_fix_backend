import "@babel/runtime/regenerator"
import express from 'express';
import {MongoClient, ObjectID} from 'mongodb';
import bodyParser from "body-parser";
import {Validator, ValidationError} from 'express-json-validator-middleware'
import {announcement_post_body, announcement_delete_query} from './validate_schema'

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
    app.get('/announcement', (req, res) => {
        announcement.find({}).toArray(((error, result) => {
            let pass_result = result.map((single_ann) => {
                return {"appid": single_ann._id, "text": single_ann.text, "image": single_ann.image}
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
    app.delete('/announcement', validate({query: announcement_delete_query}), ((req, res) => {
        announcement.deleteOne({"_id": ObjectID(req.query.appid)}).then((delete_result) => {
            if (delete_result.deletedCount === 1) {
                res.status(200).end("delete successful.");
            } else {
                res.status(400).end("no such announcement.")
            }
        }).catch(reason => {
            throw reason
        });
    }));
    app.use((err, req, res, next) => {
        if (err instanceof ValidationError) {
            // At this point you can execute your error handling code
            res.status(400).send('invalid request data.');
            next();
        } else next(err); // pass error on if not a validation error
    });
});

app.listen(8080);