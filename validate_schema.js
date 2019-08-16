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
    // "minProperties": 1,
    "properties": {
        "text": {"type": "string"},
        "image": {"type": "string"}
    }
};