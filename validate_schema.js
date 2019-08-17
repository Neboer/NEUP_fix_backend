export let announcement_post_body = {
    "type": "object",
    "properties": {
        "text": {"type": "string"},
        "image": {"type": "string"}
    },
    "required": ["text"]
};

export let announcement_update_body = {
    "type": "object",
    "minProperties": 1,
    "properties": {
        "text": {"type": "string"},
        "image": {"type": "string"}
    }
};

export let userId_get_query = {
    "type": "object",
    "properties": {
        "userid": {"type": "string"}
    },
    "required": ["userid"]
};

export let userId_put_body = {
    type:"object",
    properties:{
        userid: {type:"string"},
        name: {type:"string"},
        avatar: {type:"string"},
        signature: {type:"string"}
    },
    required:["userid","name","avatar","signature"]
};