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
            appid: {type: "string"},// 虽然appid看起来是integer，但是由于query的特点，一切皆string
            status: {
                type: "string",
                enum: ["submitted", "successful", "failed", "canceled"]
            },
            userid: {type: "string"},
            app_make_time: {type: "string", format: "date-time"},
            repair: {type: "string"},
            device_type: {type: "string"},
            device_model: {type: "string"}
        },
        additionalProperties: false
    },

    // 提交新的预约时用到的
    app_post_body: {
        type: "object",
        properties: {
            device_type: {type: "string"},
            device_model: {type: "string"},
            repair: {type: "string"},
            describe: {type: "string"},
            contact: {
                type: "array",
                items: [{
                    type: "string",
                }, {
                    type: "string"
                }],
                additionalItems: false
            },
            contact_time: {type: "string"},
            site: {type: "string"}
        },
        additionalProperties: false
    },

    // 修改预约属性
    app_update_body: {
        type: "object",
        properties: {
            status: {
                type: "string",
                enum: ["successful", "failed", "accepted"]
            },
            app_exec_time: {
                type: "string",
                format: "date-time"
            },
            member: {type: "string"},
            site: {type: "string"}
        },
        additionalProperties: false
    },

    //删除预约时提交的删除理由
    app_delete_body: {
        type: "object",
        properties: {
            reason: {type: "string"}
        },
        additionalProperties: false
    },

    //提交新的留言信息。
    mes_post_body: {
        type: "object",
        properties: {
            content_text: {
                type: "string",
            },
            content_image: {
                type: "array",
                items: {
                    type: "string",
                    format: "uri",
                },
                additionalProperties: false
            }
        },
        additionalProperties: false
    }
};
export default schema;