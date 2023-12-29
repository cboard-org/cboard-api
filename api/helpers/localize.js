const { IPinfoWrapper } = require("node-ipinfo");
const ipinfo = new IPinfoWrapper(process.env.IP_INFO_TOKEN);

module.exports = {
    findIpLocation,
    isLocalIp
};

function isLocalIp(reqIp){
    const ip = reqIp.split(':')[0];
    const LOCAL_IP = ['127.0.0.1','::1','::ffff:127.0.0.1'];
    return LOCAL_IP.includes(ip);
}

async function findIpLocation(reqIp) {
    return new Promise((resolve, reject) => {
        const ip = reqIp.split(':')[0];

        if(isLocalIp(ip))
           return reject({ message: "Local Ip supplied" });

        ipinfo.lookupIp(ip).then(
            res => {
                if (!res.country)
                    return reject({ message: "The location retrieved from Ip Info was incorrect" })

                const location = {
                    ip: res.ip,
                    country: res.country,
                    countryCode: res.countryCode,
                    region: res.region,
                    city: res.city,
                }
                return resolve(location)
            })
            .catch((error) => {
                return reject(error);
            });
    })
}