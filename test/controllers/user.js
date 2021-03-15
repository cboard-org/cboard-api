const request = require("supertest");
const chai = require ('chai');
var assert = chai.assert;

const server = require('../../app');
const helper = require('../helper');
const User = require("../../api/models/User");

function removeHeperUser(){
  User.findOneAndRemove({email: helper.userData.email }, 
  function (err, docs) { 
    if (err){ 
    console.log(err) 
    } 
    else{ 
    console.log("Removed User : ", docs); 
    } 
  }); 
}

//Parent block
describe('User API calls', function () {

  // var authToken;
  // var boardId;

  // before(async function (done) {
  //   //await Board.collection.drop();
  //   helper.prepareUser(server)
  //     .then(token => {
  //       authToken = token;
  //       done();
  //     });
  // });

  before(async function (done){
    removeHeperUser();
    done();
  });

  //   User.findOneAndRemove({email: helper.userData.email }, 
  //     function (err, docs) { 
  //       if (err){ 
  //       console.log(err) 
  //       } 
  //       else{ 
  //       console.log("Removed User : ", docs); 
  //       } 
  //       done();
  //     }); 
  // });

  it("it should has status code 200", function(done) {
    request(server)
      .get('/user')
      .expect(403)
      .end(function(err, res){
        if (err) done(err);
        done();
      });
  });

  it("it should has status code 200", function(done) {
    request(server)
      .post('/user')
      .send(helper.userData)
      .expect(200)
      //.expect(url = res.body.url)
      .end(function(err, res){
        if (err) done(err);
        done();
      });
      //console.log(url);
  });

  it('it should removes a temporaly user', (done) => {
    removeHeperUser();
    done();
//     User.findOneAndRemove({ email: "anything@cboard.io" })
//       .then(() => User.findOne(helper.userData))
//       .then((User) => {
//         assert(User === null);
//         done();
//       });
  });
});