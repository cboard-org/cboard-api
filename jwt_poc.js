const fs   = require('fs');
const jwt = require('jsonwebtoken');

const signOptions = { issuer: 'RESTORE-Skills', subject: "user@restoreskills.com", audience: "http://localhost:8080", expiresIn: "12h", algorithm: "RS256" }
const payload = {
    data1: "Data 1",
    data2: "Data 2",
    data3: "Data 3",
    data4: "Data 4",
   };

const privateKEY  = fs.readFileSync('./private.key', 'utf8');

const token = jwt.sign(payload, privateKEY, signOptions)

console.log(token)

const publicKey = fs.readFileSync('./public.key', 'utf8')

const out_payload = jwt.verify(token, publicKey)

console.log(out_payload)