const request = require('supertest');
const server = require('../../app');
const helper = require('../helper');

describe('Communicator API calls', function () {
  describe('GET /communicator/byemail/:email', function() {
    it("only allows an admin to get another user's communicators", async function() {
      const adminEmail = helper.generateEmail();
      const admin = await helper.prepareUser(server, {
        role: 'admin',
        email: adminEmail,
      });

      const userEmail = helper.generateEmail();
      const user = await helper.prepareUser(server, {
        role: 'user',
        email: userEmail,
      });

      // Try to get another user's communicators as a regular user.
      // This should fail.
      await request(server)
        .get(`/communicator/byemail/${encodeURI(adminEmail)}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect({
          message: "You are not authorized to get this user's communicators.",
        })
        .expect(403);

      // Try to get another user's communicators as an admin user.
      // This should succeed.
      await request(server)
        .get(`/communicator/byemail/${encodeURI(userEmail)}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(200);


      // Try to get my own communicators as a regular user.
      // This should succeed.
      await request(server)
        .get(`/communicator/byemail/${encodeURI(userEmail)}`)
        .set('Authorization', `Bearer ${user.token}`)
        .expect(200);
    });
  });
});
