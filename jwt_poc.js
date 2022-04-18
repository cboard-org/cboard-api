const fs   = require('fs');
const jwt = require('jsonwebtoken');

const signOptions = { issuer: 'RESTORE-Skills', subject: "123", audience: "http://localhost:8080", expiresIn: "12h", algorithm: "RS256" }
const payload = {
    id: 123,
    firstName: 'Sample',
    lastName: 'John',
    businessGroupId: 12,
    organizationId: 23,
    email: 'sample@restoreskills.com',
    role: 'user'
  };

const privateKEY  = fs.readFileSync('./private.key', 'utf8');

const token = jwt.sign(payload, privateKEY, signOptions)
// const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJkYXRhMSI6IkRhdGEgMSIsImRhdGEyIjoiRGF0YSAyIiwiZGF0YTMiOiJEYXRhIDMiLCJkYXRhNCI6IkRhdGEgNCIsImlhdCI6MTY1MDExNjI4MywiZXhwIjoxNjUwMTU5NDgzLCJhdWQiOiJodHRwOi8vbG9jYWxob3N0OjgwODAiLCJpc3MiOiJSRVNUT1JFLVNraWxscyIsInN1YiI6InVzZXJAcmVzdG9yZXNraWxscy5jb20ifQ.M2iGSh5rbcbxdrmVWFNZ5kHaN5Zt-EdXSIIo-fi0FXActwf5O3Z5mXjXrpKE5OuRrjkvQ01n6QMpXZwv93kTUw'

console.log(token)

const publicKey = fs.readFileSync('./public.key', 'utf8')

const out_payload = jwt.verify(token, publicKey)

console.log(out_payload)