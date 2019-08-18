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
    // 这个是查询符合条件的预约所用到的查询参数json
    app_get_query: {
        type: "object",
        properties: {
            appid: {type: "string"},
            status: {
                type: "string",
                enum: ["submitted", "successful", "failed", "canceled"]
            },
            userid: {type: "string"},
            app_make_time:{type:"string"},
            repair:{type:"string"},
            device_type:{type:"string"},
            device_model:{type:"string"}
        },
        additionalProperties: false
    }
};
export default schema;