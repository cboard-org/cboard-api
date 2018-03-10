"use strict";

module.exports = {
  env: "development",
  databaseUrl: process.env.MONGO_URL || "mongodb://localhost/cboard-api",
  jwt: {
    secret: process.env.JWT_SECRET
  },
  emailTransport: {
    service: "Gmail",
    from: "cboardorg@gmail.com",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "cboardorg@gmail.com",
      pass: "Auth1234"
    }
  }
};
