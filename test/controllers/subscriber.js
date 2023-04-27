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
    payPalTransactionData,
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
      subscriberRes.product.billingPeriod.should.to.deep.equal(
        subscriberData.product.billingPeriod
      );
      subscriberRes.product.price.should.to.deep.equal(
        subscriberData.product.price
      );
      subscriberRes.product.title.should.to.deep.equal(
        subscriberData.product.title
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

    const { mockPurchaseTokenVerification, mockPayPalVerification } = helper.subscriber;

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

    it('it should not creates a transaction request if purchase token is invalid', async function() {
      mockPurchaseTokenVerification({ isValidToken: false });

      const mockTransactionData = transactionData;
      const res = await request(server)
        .post(`/subscriber/${subscriber._id}/transaction`)
        .send(mockTransactionData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const transactionRes = res.body;
      transactionRes.ok.should.to.equal(false);
      transactionRes.error.message.should.to.equal(
        'Validation failed: transaction: error verifying purchase. Check if the purchase token is valid'
      );
    });

    it('it should creates a transaction field in subscriber.', async function() {
      const receiptObject = JSON.parse(transactionData.nativePurchase.receipt);
      const mockTransactionData = transactionData;
      const verifiedPurchaseReply = mockPurchaseTokenVerification({
        isValidToken: true,
      });
      const res = await request(server)
        .post(`/subscriber/${subscriber._id}/transaction`)
        .send(mockTransactionData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const transactionRes = res.body;
      const expectedExpiryDate = verifiedPurchaseReply.lineItems[0]?.expiryTime;
      const collection = transactionRes.data.collection;
      const firstCollection = collection[0];
      transactionRes.ok.should.to.equal(true);
      transactionRes.data.id.should.to.deep.equal(
        mockTransactionData.nativePurchase.productId
      );
      transactionRes.data.latest_receipt.should.to.deep.equal(true);
      transactionRes.data.transaction.type.should.to.deep.equal(
        mockTransactionData.platform
      );
      transactionRes.data.transaction.data.transaction.nativePurchase.should.to.deep.equal(
        {
          ...mockTransactionData.nativePurchase,
          receipt: receiptObject,
        }
      );
      transactionRes.data.transaction.data.success.should.to.deep.equal(true);

      firstCollection.expiryDate.should.to.deep.equal(expectedExpiryDate);
      firstCollection.isExpired.should.to.deep.equal(false);
      firstCollection.isBillingRetryPeriod.should.to.deep.equal(false);
    });

    it('it should creates a transaction field in subscriber using paypal.', async function() {
      const mockTransactionData = payPalTransactionData;
      const verifiedPurchaseReply = mockPayPalVerification({ isValid: true })
      const res = await request(server)
        .post(`/subscriber/${subscriber._id}/transaction`)
        .send(mockTransactionData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const transactionRes = res.body;
      const collection = transactionRes.data.collection;
      const firstCollection = collection[0];
      transactionRes.ok.should.to.equal(true);
      console.log('transactionRes',transactionRes);
      transactionRes.data.id.should.to.deep.equal(
        mockTransactionData.products[0].id
      );
      transactionRes.data.latest_receipt.should.to.deep.equal(true);
      transactionRes.data.transaction.type.should.to.deep.equal(
        mockTransactionData.platform
      );
      transactionRes.data.transaction.data.transaction.nativePurchase.should.to.deep.equal(
        {
          ...verifiedPurchaseReply
        }
      );
      transactionRes.data.transaction.data.success.should.to.deep.equal(true);

      firstCollection.expiryDate.should.to.deep.equal(verifiedPurchaseReply.billing_info.next_billing_time);
    });

    it('it should not creates a PayPal transaction field if subscriptionId is invalid', async function() {
      mockPayPalVerification({ isValid: false });

      const mockTransactionData = payPalTransactionData;
      const res = await request(server)
        .post(`/subscriber/${subscriber._id}/transaction`)
        .send(mockTransactionData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const transactionRes = res.body;
      transactionRes.ok.should.to.equal(false);
      // transactionRes.error.message.should.to.equal(
      //   'Validation failed: transaction: error verifying purchase. Check if the purchase token is valid'
      // );
    });

    it('it should should response that transaction is expired.', async function() {
      const receiptObject = JSON.parse(transactionData.nativePurchase.receipt);
      const mockTransactionData = transactionData;
      const verifiedPurchaseReply = mockPurchaseTokenVerification({
        isValidToken: true,
        isExpired: true,
      });
      const res = await request(server)
        .post(`/subscriber/${subscriber._id}/transaction`)
        .send(mockTransactionData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const transactionRes = res.body;
      const expectedExpiryDate = verifiedPurchaseReply.lineItems[0]?.expiryTime;

      const collection = transactionRes.data.collection;
      const firstCollection = collection[0];

      transactionRes.ok.should.to.equal(true);
      transactionRes.data.id.should.to.deep.equal(
        mockTransactionData.nativePurchase.productId
      );
      transactionRes.data.latest_receipt.should.to.deep.equal(true);
      transactionRes.data.transaction.type.should.to.deep.equal(
        mockTransactionData.platform
      );
      transactionRes.data.transaction.data.transaction.nativePurchase.should.to.deep.equal(
        {
          ...mockTransactionData.nativePurchase,
          receipt: receiptObject,
        }
      );
      transactionRes.data.transaction.data.success.should.to.deep.equal(true);
      firstCollection.expiryDate.should.to.deep.equal(expectedExpiryDate);
      firstCollection.isExpired.should.to.deep.equal(true);
      firstCollection.isBillingRetryPeriod.should.to.deep.equal(false);
    });

    it('it should should response that transaction is expired and is on billing retry period.', async function() {
      const receiptObject = JSON.parse(transactionData.nativePurchase.receipt);
      const mockTransactionData = transactionData;
      const verifiedPurchaseReply = mockPurchaseTokenVerification({
        isValidToken: true,
        isBillingRetryPeriod: true,
      });
      const res = await request(server)
        .post(`/subscriber/${subscriber._id}/transaction`)
        .send(mockTransactionData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);

      const transactionRes = res.body;
      const expectedExpiryDate = verifiedPurchaseReply.lineItems[0]?.expiryTime;

      const collection = transactionRes.data.collection;
      const firstCollection = collection[0];

      transactionRes.ok.should.to.equal(true);
      transactionRes.data.id.should.to.deep.equal(
        mockTransactionData.nativePurchase.productId
      );
      transactionRes.data.latest_receipt.should.to.deep.equal(true);
      transactionRes.data.transaction.type.should.to.deep.equal(
        mockTransactionData.platform
      );
      transactionRes.data.transaction.data.transaction.nativePurchase.should.to.deep.equal(
        {
          ...mockTransactionData.nativePurchase,
          receipt: receiptObject,
        }
      );
      transactionRes.data.transaction.data.success.should.to.deep.equal(true);
      firstCollection.expiryDate.should.to.deep.equal(expectedExpiryDate);
      firstCollection.isExpired.should.to.deep.equal(true);
      firstCollection.isBillingRetryPeriod.should.to.deep.equal(true);
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
      subscriberRes.product.billingPeriod.should.to.deep.equal(
        subscriberData.product.billingPeriod
      );
      subscriberRes.product.price.should.to.deep.equal(
        subscriberData.product.price
      );
      subscriberRes.product.title.should.to.deep.equal(
        subscriberData.product.title
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
      subscriberRes.product.billingPeriod.should.to.deep.equal(
        subscriberData.product.billingPeriod
      );
      subscriberRes.product.price.should.to.deep.equal(
        subscriberData.product.price
      );
      subscriberRes.product.title.should.to.deep.equal(
        subscriberData.product.title
      );
      subscriberRes.product.should.to.have.property('createdAt');
      subscriberRes.product.should.to.have.property('updatedAt');
    });
  });

  describe('patch /subscriber/${subscriberId}', function() {
    const { subscriberData: newSubscriberData } = helper.subscriber;
    const { mockPurchaseTokenVerification } = helper.subscriber;
    before(async function() {
      subscriber = await createSubscriber(user.userId);

      const server = require('../../app');
      diferentUser = await helper.prepareUser(server, {
        role: 'user',
        email: helper.generateEmail(),
      });
    });

    after(async function() {
      await deleteSubscriber(user.userId);
    });

    it('it should not update a subscriber object in database if user is not loged.', async function() {
      const subscriberData = {
        ...newSubscriberData,
        userId: user.userId,
      };
      const res = await request(server)
        .patch(`/subscriber/${subscriber._id}`)
        .send(subscriberData)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(403);

      const subscriberRes = res.body;
      subscriberRes.should.to.not.have.property('createdAt');
      subscriberRes.should.to.not.have.property('updatedAt');
    });

    it('it should not update a subscriber object in database if user Auth not match for userId.', async function() {
      const subscriberData = {
        ...newSubscriberData,
        userId: user.userId,
      };
      const res = await request(server)
        .patch(`/subscriber/${subscriber._id}`)
        .send(subscriberData)
        .set('Authorization', `Bearer ${diferentUser.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/);

      const subscriberRes = res.body;
      subscriberRes.should.to.not.have.property('createdAt');
      subscriberRes.should.to.not.have.property('updatedAt');
    });

    it('it should not update a subscriber object in database if the transaction purchase token is invalid.', async function() {
      const subscriberData = {
        ...newSubscriberData,
        userId: user.userId,
        transaction: transactionData,
      };
      mockPurchaseTokenVerification({ isValidToken: false });
      const res = await request(server)
        .patch(`/subscriber/${subscriber._id}`)
        .send(subscriberData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(409);

      const subscriberRes = res.body;
      subscriberRes.should.to.not.have.property('createdAt');
      subscriberRes.should.to.not.have.property('updatedAt');
    });

    it('it should update transaction to null.', async function() {
      const subscriberData = {
        product: {
          ...newSubscriberData.product,
          status: 'requested',
        },
        transaction: null,
      };
      const res = await request(server)
        .patch(`/subscriber/${subscriber._id}`)
        .send(subscriberData)
        .set('Authorization', `Bearer ${user.token}`)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200);
    });

    it('it should updates a subscriber object in database.', async function() {
      const subscriberData = {
        ...newSubscriberData,
        userId: user.userId,
      };
      mockPurchaseTokenVerification({ isValidToken: true });
      const res = await request(server)
        .patch(`/subscriber/${subscriber._id}`)
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
      subscriberRes.product.billingPeriod.should.to.deep.equal(
        subscriberData.product.billingPeriod
      );
      subscriberRes.product.price.should.to.deep.equal(
        subscriberData.product.price
      );
      subscriberRes.product.title.should.to.deep.equal(
        subscriberData.product.title
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

    it('it should not delete a subscriber if user is not admin', async function() {
      const res = await request(server)
        .delete(`/subscriber/${subscriber._id}`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${user.token}`)
        .expect('Content-Type', /json/)
        .expect(403);
    });

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
