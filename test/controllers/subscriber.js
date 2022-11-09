process.env.NODE_ENV = 'test';

const request = require('supertest');

const helper = require('../helper');

//Parent block
describe('Subscriber API calls', function() {
  let user;
  let server;
  const {
    subscriberData: mockSubscriberData,
    transactionData,
    createSubscriber,
    deleteSubscriber,
  } = helper.subscriber;

  before(async function() {
    helper.prepareNodemailerMock(); //enable mockery and replace nodemailer with nodemailerMock
    server = require('../../app'); //register mocks before require the original dependency
    user = await helper.prepareUser(server, {
      role: 'user',
      email: helper.generateEmail(),
    });
  });

  after(async function() {
    helper.prepareNodemailerMock(true); //disable mockery
    await helper.deleteMochaUsers();
  });

  describe('POST /subscriber', function() {
    after(async function() {
      await deleteSubscriber(user.userId);
    });

    it('it should not create a subscriber object in database if user is not loged.', async function() {
      const subscriberData = {
        ...mockSubscriberData,
        userId: user.userId,
      };
      const res = await request(server)
        .post('/subscriber')
        .send(subscriberData)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);

      const subscriberRes = res.body;
      subscriberRes.should.to.not.have.property('createdAt');
      subscriberRes.should.to.not.have.property('updatedAt');
    });

    it('it should creates a subscriber object in database.', async function() {
      const subscriberData = {
        ...mockSubscriberData,
        userId: user.userId,
      };
      const res = await request(server)
        .post('/subscriber')
        .send(subscriberData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const subscriberRes = res.body;
      subscriberRes.should.to.have.property('_id');
      subscriberRes.userId.should.to.equal(subscriberData.userId);
      subscriberRes.country.should.to.deep.equal(subscriberData.country);
      subscriberRes.status.should.to.deep.equal(subscriberData.status);
      subscriberRes.should.to.have.property('createdAt');
      subscriberRes.should.to.have.property('updatedAt');
      subscriberRes.product.planId.should.to.deep.equal(
        subscriberData.product.planId
      );
      subscriberRes.product.subscriptionId.should.to.deep.equal(
        subscriberData.product.subscriptionId
      );
      subscriberRes.product.status.should.to.deep.equal(
        subscriberData.product.status
      );
      subscriberRes.product.should.to.have.property('createdAt');
      subscriberRes.product.should.to.have.property('updatedAt');
    });

    it('it should not create a subscriber object in database for an already subscribed user.', async function() {
      const subscriberData = {
        ...mockSubscriberData,
        userId: user.userId,
      };
      const res = await request(server)
        .post('/subscriber')
        .send(subscriberData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(409);

      const subscriberRes = res.body;
      subscriberRes.should.to.not.have.property('createdAt');
      subscriberRes.should.to.not.have.property('updatedAt');
    });
  });

  describe('POST /subscriber/${subscriber.id}/transaction', function() {
    let subscriber;

    before(async function() {
      subscriber = await createSubscriber(user.userId);
    });
    after(async function() {
      await deleteSubscriber(user.userId);
    });

    it('it should not creates a transaction field if user is not registered', async function() {
      const mockTransactionData = transactionData;
      const res = await request(server)
        .post(`/subscriber/${subscriber._id}/transaction`)
        .send(mockTransactionData)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    it('it should not creates a transaction field if id not match.', async function() {
      const mockTransactionData = transactionData;
      const res = await request(server)
        .post(`/subscriber/invalid/transaction`)
        .send(mockTransactionData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const transactionRes = res.body;
      transactionRes.ok.should.to.equal(false);
    });

    it('it should creates a transaction field in subsciber.', async function() {
      const receiptObject = JSON.parse(transactionData.transaction.receipt);
      const mockTransactionData = transactionData;
      const res = await request(server)
        .post(`/subscriber/${subscriber._id}/transaction`)
        .send(mockTransactionData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const transactionRes = res.body;

      transactionRes.ok.should.to.equal(true);
      transactionRes.data.transaction.should.to.deep.equal({
        ...mockTransactionData.transaction,
        receipt: receiptObject,
      });
    });
  });

  describe('get /subscriber/${subscriber.userId}', function() {
    let subscriber;
    let diferentUser;
    let adminUser;
    before(async function() {
      subscriber = await createSubscriber(user.userId);

      const server = require('../../app'); //register mocks before require the original dependency
      diferentUser = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
      adminUser = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.generateEmail(),
      });
    });

    after(async function() {
      await deleteSubscriber(user.userId);
    });

    it('it should not get a subscriber object in database if user is not loged.', async function() {
      const res = await request(server)
        .get(`/subscriber/${user.userId}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);

      const subscriberRes = res.body;
      subscriberRes.should.to.not.have.property('createdAt');
      subscriberRes.should.to.not.have.property('updatedAt');
    });

    it('it should not get a subscriber object in database if user token not match.', async function() {
      const res = await request(server)
        .get(`/subscriber/${user.userId}`)
        .set('Authorization', `Bearer ${diferentUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401);

      const subscriberRes = res.body;
      subscriberRes.should.to.not.have.property('createdAt');
      subscriberRes.should.to.not.have.property('updatedAt');
    });

    it('it should not get a subscriber object in database if subscriber not exists.', async function() {
      const res = await request(server)
        .get(`/subscriber/${diferentUser.userId}`)
        .set('Authorization', `Bearer ${diferentUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(404);

      const subscriberRes = res.body;
      subscriberRes.should.to.not.have.property('createdAt');
      subscriberRes.should.to.not.have.property('updatedAt');
    });

    it('it should get a subscriber object.', async function() {
      const subscriberData = {
        ...mockSubscriberData,
        userId: user.userId,
      };
      const res = await request(server)
        .get(`/subscriber/${user.userId}`)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const subscriberRes = res.body;
      subscriberRes.should.to.have.property('_id');
      subscriberRes.userId.should.to.equal(subscriberData.userId);
      subscriberRes.country.should.to.deep.equal(subscriberData.country);
      subscriberRes.status.should.to.deep.equal(subscriberData.status);
      subscriberRes.should.to.have.property('createdAt');
      subscriberRes.should.to.have.property('updatedAt');
      subscriberRes.product.planId.should.to.deep.equal(
        subscriberData.product.planId
      );
      subscriberRes.product.subscriptionId.should.to.deep.equal(
        subscriberData.product.subscriptionId
      );
      subscriberRes.product.status.should.to.deep.equal(
        subscriberData.product.status
      );
      subscriberRes.product.should.to.have.property('createdAt');
      subscriberRes.product.should.to.have.property('updatedAt');
    });

    it('it should get a subscriber object whith an admin token', async function() {
      const subscriberData = {
        ...mockSubscriberData,
        userId: user.userId,
      };
      const res = await request(server)
        .get(`/subscriber/${user.userId}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const subscriberRes = res.body;
      subscriberRes.should.to.have.property('_id');
      subscriberRes.userId.should.to.equal(subscriberData.userId);
      subscriberRes.country.should.to.deep.equal(subscriberData.country);
      subscriberRes.status.should.to.deep.equal(subscriberData.status);
      subscriberRes.should.to.have.property('createdAt');
      subscriberRes.should.to.have.property('updatedAt');
      subscriberRes.product.planId.should.to.deep.equal(
        subscriberData.product.planId
      );
      subscriberRes.product.subscriptionId.should.to.deep.equal(
        subscriberData.product.subscriptionId
      );
      subscriberRes.product.status.should.to.deep.equal(
        subscriberData.product.status
      );
      subscriberRes.product.should.to.have.property('createdAt');
      subscriberRes.product.should.to.have.property('updatedAt');
    });
  });

  describe('DELETE /subscriber/${subscriber.id}', function() {
    let subscriber;
    let adminUser;

    before(async function() {
      subscriber = await createSubscriber(user.userId);
      adminUser = await helper.prepareUser(server, {
        role: 'admin',
        email: helper.generateEmail(),
      });
    });
    after(async function() {
      deleteSubscriber(user.userId);
    });

    it('it should not delete a subscriber if auth is not present', async function() {
      const res = await request(server)
        .delete(`/subscriber/${subscriber._id}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);
    });

    //THIS BREAK API
    // it('it should not delete a subscriber if user is not admin', async function () {
    //     const res = await request(server)
    //       .delete(`/subscriber/${subscriber._id}`)
    //       .set('Accept', 'application/json')
    //       .set('Authorization', `Bearer ${user.token}`)
    //       .expect('Content-Type', /json/)
    //       .expect(403);
    // });

    it('it should delete a subscriber.', async function() {
      const res = await request(server)
        .delete(`/subscriber/${subscriber._id}`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const subscriberRes = res.body;
      subscriberRes.should.to.have.property('_id');
      subscriberRes.userId.should.to.equal(user.userId);
      subscriberRes.country.should.to.deep.equal(subscriber.country);
      subscriberRes.status.should.to.deep.equal(subscriber.status);
      subscriberRes.should.to.have.property('createdAt');
      subscriberRes.should.to.have.property('updatedAt');
    });
  });
});
