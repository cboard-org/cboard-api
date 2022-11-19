const { findIpLocation } = require("../helpers/localize")

module.exports = {
    location
};

async function location(req, res) {
    try {
        const location = await findIpLocation(req.ip)
        delete location.ip;
        res.status(200).json(location);
    } catch (error) {
        res.status(404).json({ message: `Cannot get the location, ${error.message}` });
    }
}