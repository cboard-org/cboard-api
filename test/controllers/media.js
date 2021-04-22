const request = require('supertest');
const chai = require('chai');

const helper = require('../helper');

const fs = require('fs');
const { expect } = require('chai');

//Parent block
describe('media API calls', function () {
  let server;

  before(async function () {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
  });

  after(async function () {
    helper.prepareNodemailerMock(true);
    helper.deleteMochaUsers();
  });

  describe('POST /media', function () {
    before(async function () {
      user = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
    });

    it('it should NOT post a media file without authToken.', async function () {
      const res = await request(server)
        .post('/media')
        .set('Accept', 'image/webp,*/*')
        .set(
          'Content-Disposition',
          'form-data; name="file"; filename="postman.png"'
        )
        .set(
          'Content-Type',
          'image/png',
          'multipart/form-data; boundary=---------------------------5993600411909833853278497880'
        )
        .attach(
          'file',
          fs.readFileSync('./public/images/postman.png'),
          'postman.png'
        )
        .expect(403);
    });

    it('it should post a media file.', async function () {
      const res = await request(server)
        .post('/media')
        .set('Authorization', 'Bearer ' + user.token)
        .set('Accept', 'image/webp,*/*')
        .set(
          'Content-Disposition',
          'form-data; name="file"; filename="postman.png"'
        )
        .set(
          'Content-Type',
          'image/png',
          'multipart/form-data; boundary=---------------------------5993600411909833853278497880'
        )
        .attach(
          'file',
          fs.readFileSync('./public/images/postman.png'),
          'postman.png'
        )
        .expect(200);

      res.body.url.should.be.a('string');
    });
  });
});
