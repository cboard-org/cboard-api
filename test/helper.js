
//Require the dev-dependencies
const chai = require('chai');
const mongoose = require('mongoose');
const chaiHttp = require('chai-http');
const { check } = require("prettier");
const should = chai.should();

const User = require('../api/models/User');

const checkListProperties = body => {
    body.should.be.a('object');
    body.should.have.property('total');
    body.should.have.property('page');
    body.should.have.property('limit');
    body.should.have.property('offset');
    body.should.have.property('sort');
    body.should.have.property('search');
    body.should.have.property('data');
};

const userData = {
    name: "cboard mocha test",
    email: "anything@cboard.io",
    password: "123456"
};

const board = {
    id: 'root',
    name: 'home',
    author: 'Cboard',
    email: 'support@cboard.io',
    isPublic: true,
    hidden: false,
    tiles: [
        {
            labelKey: 'cboard.symbol.yes',
            image: '/symbols/mulberry/correct.svg',
            id: 'HJVQMR9pX5F-',
            backgroundColor: 'rgb(255, 241, 118)',
            label: 'yes'
        },
        {
            labelKey: 'symbol.descriptiveState.no',
            image: '/symbols/mulberry/no.svg',
            id: 'SkBQMRqpX5t-',
            backgroundColor: 'rgb(255, 241, 118)',
            label: 'no'
        }
    ]
};

function prepareDb(server, done) {
    mongoose.connect("mongodb://127.0.0.1:27017/cboard-api", {
        useNewUrlParser: true
    });
    const connection = mongoose.connection;
    connection.once("open", function () {
        mongoose.connection.db.dropDatabase(
            function (err, result) {
                console.log("Database droped");
                chai.request(server)
                    .post('/user')
                    .send(userData)
                    .end(function (err, res) {
                        console.log(res.body);
                        res.should.have.status(200);
                        res.body.success.should.to.equal(1);
                        done();
                    });
            });
    });
}

module.exports = {
    checkListProperties,
    prepareDb,
    board,
    userData
};