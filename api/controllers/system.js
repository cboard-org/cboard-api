const db = require('../../db')
// const mongoHealtCheck = require("@mongodb-helpers/health-check").healthCheck;

module.exports = {
    healthCheck: healthCheck
}
async function healthCheck(req, res) {
    if(db.readyState === 1){
        return res.status(200).json({healthcheck: true})
    }else{
        return res.status(500).json({healthcheck: false})
    }
}