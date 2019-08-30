export function getCurrentIndexValue(key_name, counter_collection) {
    // 一个记录就是{appid:42}，下一个记录{mesid:56}
    return counter_collection.findOne({[key_name]: {$exists: true}}).then(result => {
        return result[key_name]
    })
}

export function updateAndGetNextIndexValue(key_name, counter_collection) {
    counter_collection.findOneAndUpdate({[key_name]: {$exists: true}}, {$inc: {[key_name]: 1}}).then(result => {
        return (result.value[key_name] + 1)
    })
}

export function checkAndMakeCounter(counter_collection) {
    counter_collection.findOne({'appid': {$exists: true}}).then(result => {
        if (result === null) {
            counter_collection.insertMany([{'appid': 0}, {'mesid': 0}])
        }
    })
}