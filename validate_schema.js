export let announcement_post_body = {
    "type":"object",
    "properties":{
        "text":{"type":"string"},
        "image":{"type":"string"}
    },
    "required":["text","image"]
};

export let announcement_delete_query = {
    "type":"object",
    "properties":{
        "appid":{"type":"string"}
    },
    "required":["appid"]
};