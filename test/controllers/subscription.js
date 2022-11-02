process.env.NODE_ENV = 'test';

const request = require('supertest');

const helper = require('../helper');

describe('Subscription API calls', function() {
  let user;
  let server;
  let adminUser;
  const {
    subscriptionId,
    subscriptionData,
    createSubscription,
    deleteSubscription,
  } = helper.subscription;

  before(async function() {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
    user = await helper.prepareUser(server, {
      role: 'user',
      email: helper.generateEmail(),
    });
    adminUser = await helper.prepareUser(server, {
      role: 'admin',
      email: helper.generateEmail(),
    });
    await deleteSubscription();
  });

  after(async function() {
    helper.prepareNodemailerMock(true); //disable mockery
    await helper.deleteMochaUsers();
  });

  describe('POST /subscription/{subscriptionId}', function() {
    after(async function() {
      await deleteSubscription();
    });
    // it('it should not create a subscription object in database if user is not loged.', async function() {
    //   const mockSubscriberData = helper.subscriptionData;
    //   const res = await request(server)
    //     .post(`/subscription/${subscriptionId}`)
    //     .send(mockSubscriberData)
    //     .set('Accept', 'application/json')
    //     .expect('Content-Type', /json/)
    //     // .expect(403);

    //   const subscriptionRes = res.body;
    //   subscriptionRes.should.to.not.have.property('createdAt');
    //   subscriptionRes.should.to.not.have.property('updatedAt');
    // });

    // it('it should not create a subscription object in database if user is not admin.', async function() {
    //   const mockSubscriberData = helper.subscriptionData;
    //   const res = await request(server)
    //     .post(`/subscription/${subscriptionId}`)
    //     .send(mockSubscriberData)
    //     .set('Authorization', `Bearer ${user.token}`)
    //     .set('Accept', 'application/json')
    //     .expect('Content-Type', /json/)
    //     .expect(403);

    //   const subscriptionRes = res.body;
    //   subscriptionRes.should.to.not.have.property('createdAt');
    //   subscriptionRes.should.to.not.have.property('updatedAt');
    // });

    it('it should create a subscription object in database.', async function() {
      const res = await request(server)
        .post(`/subscription/${subscriptionId}`)
        .send(subscriptionData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const subscriptionRes = res.body;
      subscriptionRes.should.to.have.property('createdAt');
      subscriptionRes.should.to.have.property('updatedAt');
      subscriptionRes.should.to.have.property('_id');
      subscriptionRes.subscriptionId.should.to.equal(subscriptionId);
      subscriptionRes.name.should.to.deep.equal(subscriptionData.name);
      subscriptionRes.status.should.to.deep.equal(subscriptionData.status);
      subscriptionRes.platform.should.to.deep.equal(subscriptionData.platform);
      subscriptionRes.benefits.should.to.deep.equal(subscriptionData.benefits);
      subscriptionRes.plans[0].should.to.have.property('createdAt');
      subscriptionRes.plans[0].should.to.have.property('updatedAt');
    });

    it('it should not create a subscription object in database with the same subscription ID.', async function() {
      const res = await request(server)
        .post(`/subscription/${subscriptionId}`)
        .send(subscriptionData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(409);
    });
  });

  describe('GET /subscription/{subscriptionId}', function() {
    before(async function() {
      await createSubscription();
    });

    after(async function() {
      await deleteSubscription();
    });
    // it('it should not get a subscription object if user is not loged.', async function() {
    //   const res = await request(server)
    //     .get(`/subscription/${subscriptionId}`)
    //     .set('Accept', 'application/json')
    //     .expect('Content-Type', /json/)
    //     .expect(403);
    // });

    // it('it should not get a subscription object in database if user is not admin.', async function() {
    //   const res = await request(server)
    //     .get(`/subscription/${subscriptionId}`)
    //     .set('Authorization', `Bearer ${user.token}`)
    //     .set('Accept', 'application/json')
    //     .expect('Content-Type', /json/)
    //     .expect(403);
    // });

    it('it should not get a subscription object for a non-existing subscription Id.', async function() {
      const nonExistingSubscriptionId = 'non-existing-id';
      const res = await request(server)
        .get(`/subscription/${nonExistingSubscriptionId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      const subscriptionRes = res.body;
      subscriptionRes.should.to.not.have.property('createdAt');
      subscriptionRes.should.to.not.have.property('updatedAt');
      subscriptionRes.should.to.not.have.property('_id');
      subscriptionRes.message.should.to.deep.equal(
        'Subscription does not exist. Subscription Id: ' +
          nonExistingSubscriptionId
      );
    });

    it('it should get a subscription object.', async function() {
      const res = await request(server)
        .get(`/subscription/${subscriptionId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const subscriptionRes = res.body;
      subscriptionRes.should.to.have.property('createdAt');
      subscriptionRes.should.to.have.property('updatedAt');
      subscriptionRes.should.to.have.property('_id');
      subscriptionRes.subscriptionId.should.to.equal(subscriptionId);
      subscriptionRes.name.should.to.deep.equal(subscriptionData.name);
      subscriptionRes.status.should.to.deep.equal(subscriptionData.status);
      subscriptionRes.platform.should.to.deep.equal(subscriptionData.platform);
      subscriptionRes.benefits.should.to.deep.equal(subscriptionData.benefits);
      subscriptionRes.plans[0].should.to.have.property('createdAt');
    });
  });

  describe('PUT /subscription/{subscriptionId}', function() {
    const updateSubscriptionData = helper.subscription.updateSubscriptionData;

    before(async function() {
      await createSubscription();
    });

    after(async function() {
      await deleteSubscription();
    });

    // it('it should not update a subscription object in database if user is not loged.', async function() {
    //   const mockSubscriberData = helper.subscriptionData;
    //   const res = await request(server)
    //     .put(`/subscription/${subscriptionId}`)
    //     .send(mockSubscriberData)
    //     .set('Accept', 'application/json')
    //     .expect('Content-Type', /json/)
    //     .expect(403);
    // });

    // it('it should not update a subscription object in database if user is not admin.', async function() {
    //   const mockSubscriberData = helper.subscriptionData;
    //   const res = await request(server)
    //     .put(`/subscription/${subscriptionId}`)
    //     .send(mockSubscriberData)
    //     .set('Authorization', `Bearer ${user.token}`)
    //     .set('Accept', 'application/json')
    //     .expect('Content-Type', /json/)
    //     .expect(403);
    // });
    it('it should not update a subscription object for a non-existing subscription Id.', async function() {
      const nonExistingSubscriptionId = 'non-existing-id';
      const res = await request(server)
        .put(`/subscription/${nonExistingSubscriptionId}`)
        .send(updateSubscriptionData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      const subscriptionRes = res.body;
      subscriptionRes.should.to.not.have.property('createdAt');
      subscriptionRes.should.to.not.have.property('updatedAt');
      subscriptionRes.should.to.not.have.property('_id');
      subscriptionRes.message.should.to.deep.equal(
        'Subscription does not exist. Subscription Id: ' +
          nonExistingSubscriptionId
      );
    });

    it('it should update a subscription object in database.', async function() {
      const res = await request(server)
        .put(`/subscription/${subscriptionId}`)
        .send(updateSubscriptionData)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const subscriptionRes = res.body;
      subscriptionRes.should.to.have.property('createdAt');
      subscriptionRes.should.to.have.property('updatedAt');
      subscriptionRes.updatedAt.should.to.not.deep.equal(
        subscriptionRes.createdAt
      );
      subscriptionRes.should.to.have.property('_id');
      subscriptionRes.subscriptionId.should.to.equal(subscriptionId);
      subscriptionRes.name.should.to.deep.equal(updateSubscriptionData.name);
      subscriptionRes.status.should.to.deep.equal(
        updateSubscriptionData.status
      );
      subscriptionRes.platform.should.to.deep.equal(
        updateSubscriptionData.platform
      );
      subscriptionRes.benefits.should.to.deep.equal(
        updateSubscriptionData.benefits
      );
      subscriptionRes.plans[0].should.to.have.property('createdAt');
    });
  });

  describe('DELETE /subscription/{subscriptionId}', function() {
    before(async function() {
      await createSubscription();
    });

    after(async function() {
      await deleteSubscription();
    });

    // it('it should not DELETE a subscription object in database if user is not loged.', async function() {
    //   const res = await request(server)
    //     .delete(`/subscription/${subscriptionId}`)
    //     .set('Accept', 'application/json')
    //     .expect('Content-Type', /json/)
    //     .expect(403);
    // });

    // it('it should not DELETE a subscription object in database if user is not admin.', async function() {
    //   const res = await request(server)
    //     .delete(`/subscription/${subscriptionId}`)
    //     .set('Authorization', `Bearer ${user.token}`)
    //     .set('Accept', 'application/json')
    //     .expect('Content-Type', /json/)
    //     .expect(403);
    // });

    it('it should DELETE a subscription object in database.', async function() {
      const res = await request(server)
        .delete(`/subscription/${subscriptionId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const subscriptionRes = res.body;
      subscriptionRes.should.to.have.property('createdAt');
      subscriptionRes.should.to.have.property('updatedAt');
      subscriptionRes.should.to.have.property('_id');
      subscriptionRes.subscriptionId.should.to.equal(subscriptionId);
      subscriptionRes.name.should.to.deep.equal(subscriptionData.name);
      subscriptionRes.status.should.to.deep.equal(subscriptionData.status);
      subscriptionRes.platform.should.to.deep.equal(subscriptionData.platform);
      subscriptionRes.benefits.should.to.deep.equal(subscriptionData.benefits);
      subscriptionRes.plans[0].should.to.have.property('createdAt');
    });
  });
});
