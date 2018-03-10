# Cboard API - REST API for CBoard application

[Cboard](https://app.cboard.io/) is an augmentative and alternative communication (AAC) web application, allowing users with speech and language impairments (autism, cerebral palsy) to communicate by symbols and text-to-speech. This repo supports the CBoard front-end, providing backend functionality and persistence.

Learn more about the [Cboard project](https://github.com/cboard-org/cboard).
## Quick start

### Pre-requisites
Before installing and running the Cboard API, be sure you have **locally** installed the following tools:
* Node.js > 7.0.0 (download [here](https://nodejs.org/en/download/))
* MongoDB > 3.0.0 (download [here](https://docs.mongodb.com/manual/installation/))
* Swagger

Install Swagger globally using npm: 

`npm install -g swagger`

If needed, check out the Swagger docs [here](https://github.com/swagger-api/swagger-node/blob/master/docs/install.md).

Use the following commands to check that you have them successfully installed, and/or to double-check your versions:
* `node -v`
* `mongo --version`
* `swagger --version`

### Install
Clone the repository and install npm dependencies:
```bash
$ git clone https://github.com/cboard-org/cboard-api.git
$ cd cboard-api
$ npm install
```
### Start the database

Start MongoDB. ([See MongoDB docs, if needed](https://docs.mongodb.com/manual/tutorial/manage-mongodb-processes/)).

```bash
$ mongod
```

### Run the API Server

In a separate terminal tab/window, run the Swagger project server.

```bash
$ swagger project start
```

This will start a server process listening on port 10010. You will now be able to make calls to the API.

(If you are having trouble, make sure you have successfully installed the pre-requisites -- see "Pre-requisites" section above.)

### See API Paths

Swagger provides an interactive, browser-based editor. To visualize available API endpoints, start the editor:

```bash
$ swagger project edit
```
That should open a browser window and show API swagger editor (as shown below):
<img src='https://i.imgur.com/pt0eJVQ.png' width='600' alt='Cboard API Swagger'>

### Mailing system configuration
When a new user is created using the API, some verification emails are generated. To use a specific SMPT server, locally edit the following file to use values for an SMTP server you own:
**config/env/development.js**
And look for following config block:
```javascript
    emailTransport: {
        from: 'cboard@cboard.io',
        host: 'smtp.sendgrid.net',
        port: 465,
        secure: true,
        service: 'Sendgrid',
        auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY
        }
    }
```

## License

Code - [GPLv3](https://github.com/shayc/cboard/blob/master/LICENSE)  
Symbols - [CC BY-SA](https://creativecommons.org/licenses/by-sa/2.0/uk/)
