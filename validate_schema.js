let schema = {
    announcement_post_body: {
        type: "object",
        properties: {
            "text": {type: "string"},
            "image": {type: "string"}
        },
        required: ["text"],
        additionalProperties: false
    },
    announcement_update_body: {
        type: "object",
        minProperties: 1,
        properties: {
            text: {type: "string"},
            image: {type: "string"}
        },
        additionalProperties: false
    },
    userId_get_query: {
        type: "object",
        properties: {
            userid: {type: "string"}
        },
        required: ["userid"],
        additionalProperties: false
    },
    userId_put_body: {
        type: "object",
        properties: {
            name: {type: "string"},
            avatar: {type: "string"},
            signature: {type: "string"}
        },
        required: ["name", "avatar", "signature"],
        additionalProperties: false
    },
    app_get_query:{

    }
};
export default schema;