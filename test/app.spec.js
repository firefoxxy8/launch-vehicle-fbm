const assert = require('assert');
const chai = require('chai');
const chaiHttp = require('chai-http');
const config = require('config');
const reqPromise = require('request-promise');
const sinon = require('sinon');

const app = require('../../src/messenger/app');

chai.use(chaiHttp);

describe('app', () => {
  const messenger = new app.Messenger(config);
  let session;

  beforeEach(() => {
    sinon.stub(messenger, 'send');
    session = {
      profile: {
        first_name: '  Guy  ',
        last_name: '  Hoozdis  '
      }
    };
  });

  afterEach(() => {
    // TODO investigate making the suite mock `reqPromise.post` instead of `send`
    messenger.send.restore && messenger.send.restore();
  });


  describe('doLogin', function () {
    this.timeout(100);
    it('emits login event', () => {
      messenger.once('login', (payload) => {
        assert.ok(payload.event);
        assert.equal(payload.senderId, 'narf');
      });

      messenger.doLogin('narf');

      assert.equal(messenger.send.callCount, 1);
    });
  });


  describe('onAuth', function () {
    this.timeout(100);
    const baseEvent = {
      sender: {id: 'senderId'},
      recipient: {id: 'recipientId'},
      timestamp: 0,
      optin: {ref: ''}
    };

    it('emits auth event', () => {
      messenger.once('auth', (payload) => {
        assert.ok(payload.event);
        assert.ok(payload.session);
        assert.equal(payload.senderId, 'senderId');
        assert.equal(payload.optinRef, 'narf');
      });
      const event = Object.assign({}, baseEvent, {
        optin: {
          ref: 'narf'
        }
      });

      messenger.onAuth(event, {});

      assert.equal(messenger.send.callCount, 0);
    });
  });

  describe('onLink', function () {
    this.timeout(100);
    const baseEvent = {
      sender: {id: 'senderId'},
      recipient: {id: 'recipientId'},
      timestamp: 0,
      facebook: {id: ''}
    };

    it('emits link event', () => {
      messenger.once('link', (payload) => {
        assert.ok(payload.event);
        assert.equal(payload.senderId, 'senderId');
        assert.equal(payload.fbData.id, 'narf');
      });
      const event = Object.assign({}, baseEvent, {
        facebook: {
          id: 'narf'
        }
      });

      messenger.onLink(event);
    });
  });

  describe('onMessage message router', function () {
    this.timeout(100);
    const baseEvent = {
      sender: {id: 'senderId'},
      recipient: {id: 'recipientId'},
      timestamp: 0,
      message: {}
    };

    it('emits "message" event', () => {
      messenger.once('message', (payload) => {
        assert.ok(payload.event);
        assert.equal(payload.senderId, 'senderId');
        assert.deepEqual(payload.message, {foo: 'bar'});
      });
      const event = Object.assign({}, baseEvent, {
        message: {foo: 'bar'}
      });

      messenger.onMessage(event);
    });

    it('emits "text" event', () => {
      const event = Object.assign({}, baseEvent, {
        message: {
          text: 'message text'
        }
      });
      const fakeSession = {};
      messenger.once('text', (payload) => {
        assert.ok(payload.event);
        assert.equal(payload.senderId, 'senderId');
        assert.equal(payload.source, 'text');
        assert.equal(payload.text, 'message text');
      });

      messenger.onMessage(event, fakeSession);
    });

    it('emits "quick reply" event', () => {
      const messageText = 'Text message test';
      const quickReplyPayload = 'quick-reply-payload';
      messenger.once('text', (quickReply) => {
        assert.ok(quickReply.event);
        assert.equal(quickReply.senderId, 'senderId');
        assert.equal(quickReply.source, 'quickReply');
        assert.equal(quickReply.text, quickReplyPayload);
      });
      const event = Object.assign({}, baseEvent, {
        message: {
          quick_reply: { payload: quickReplyPayload },
          text: messageText
        }
      });

      messenger.onMessage(event, {});
    });


    it('emits "image" event', () => {
      messenger.once('message.image', (payload) => {
        assert.ok(payload.event);
        assert.equal(payload.senderId, 'senderId');
        assert.equal(payload.url, 'http://i.imgur.com/w1F7dae.jpg');
      });
      const event = Object.assign({}, baseEvent, {
        message: {
          attachments: [
            {
              type: 'image',
              payload: {
                url: 'http://i.imgur.com/w1F7dae.jpg'
              }
            }
          ]
        }
      });

      messenger.onMessage(event);
    });

    it('emits "sticker" event', () => {
      messenger.once('message.sticker', () => {});
      const event = Object.assign({}, baseEvent, {
        message: {
          sticker_id: 201013950048539,
          attachments: [
            {
              type: 'image',
              payload: {
                url: 'https://scontent.xx.fbcdn.net/t39.1997-6/p100x100/851576_201013953381872_1273966384_n.png?_nc_ad=z-m',
                sticker_id: 201013950048539
              }
            }
          ]
        }
      });

      messenger.onMessage(event);
    });

    it('emits "thumbsup" event', () => {
      messenger.once('message.thumbsup', (payload) => {
        assert.equal(payload.senderId, 'senderId');
      });
      const event = Object.assign({}, baseEvent, {
        message: {
          sticker_id: 369239263222822,
          attachments: [
            {
              type: 'image',
              payload: {
                url: 'https://scontent.xx.fbcdn.net/t39.1997-6/851557_369239266556155_759568595_n.png?_nc_ad=z-m',
                sticker_id: 369239263222822
              }
            }
          ]
        }
      });

      messenger.onMessage(event);
    });

    it('emits "greeting" event', () => {
      const text = "hello, is it me you're looking for?";
      const event = Object.assign({}, baseEvent, { message: { text: text } });
      messenger.once('text.greeting', (payload) => {
        assert.ok(payload.event);
        assert.equal(payload.senderId, 'senderId');

        assert.ok(payload.firstName);
        assert.ok(payload.surName);
        assert.ok(payload.fullName);
      });

      messenger.once('message.text', (payload) => {
        assert.fail('message.text', 'text.greeting', 'incorrect event emitted');
      });

      messenger.onMessage(event, session);
    });

    it('emits "greeting" event when provided a pattern', () => {
      const myMessenger = new app.Messenger(config, {emitGreetings: /^olleh/i});
      sinon.stub(myMessenger, 'send');

      const text = "olleh, it's just olleh, backwards";
      const event = Object.assign({}, baseEvent, { message: { text: text } });
      myMessenger.once('text.greeting', (payload) => {
        assert.ok(payload.event);
        assert.equal(payload.senderId, 'senderId');
      });

      myMessenger.once('message.text', (payload) => {
        assert.fail('message.text', 'text.greeting', 'incorrect event emitted');
      });

      myMessenger.onMessage(event, session);
    });

    it('emits "text" event for greeting when emitGreetings is disabled', () => {
      const myMessenger = new app.Messenger(config, {emitGreetings: false});
      sinon.stub(myMessenger, 'send');

      const text = "hello, is it me you're looking for?";
      const event = Object.assign({}, baseEvent, {
        message: { text: text }
      });
      myMessenger.once('text.greeting', (payload) => {
        assert.fail('text', 'text.greeting', 'incorrect event emitted');
      });

      myMessenger.once('text', (payload) => {
        assert.ok(payload.event);
        assert.equal(payload.senderId, 'senderId');
      });

      myMessenger.onMessage(event, {});
    });

    it('emits "help" event', () => {
      const text = "help me out";
      const event = Object.assign({}, baseEvent, { message: { text: text } });
      messenger.once('text.help', (payload) => {
        assert.ok(payload.event);
        assert.equal(payload.senderId, 'senderId');
      });

      messenger.once('message.text', (payload) => {
        assert.fail('message.text', 'text.help', 'incorrect event emitted');
      });

      messenger.onMessage(event, {});
    });
  });

  describe('onPostback', function () {
    this.timeout(100);
    const baseEvent = {
      sender: {id: 'senderId'},
      recipient: {id: 'recipientId'},
      timestamp: 0,
      postback: {payload: ''}
    };

    it('emits postback event', () => {
      messenger.once('text', (payload) => {
        assert.ok(payload.event);
        assert.equal(payload.senderId, 'senderId');
        assert.equal(payload.source, 'postback');
        assert.equal(payload.text, 'narf');
      });
      const event = Object.assign({}, baseEvent, {
        postback: {
          payload: 'narf'
        }
      });

      messenger.onPostback(event);
    });
  });

  describe('send', function () {
    let postStub;

    beforeEach(() => {
      postStub = sinon.stub(reqPromise, 'post').returns(Promise.resolve({}));
    });

    afterEach(() => {
      postStub.restore();
    });

    it('passed sender id and message', () => {
      messenger.send.restore();

      return messenger.send('senderId', {foo: 'bar'})
        .then(() => {
          assert.equal(reqPromise.post.args[0][0].json.recipient.id, 'senderId');
          assert.deepEqual(reqPromise.post.args[0][0].json.message, {foo: 'bar'});
        });
    });
  });

  describe('staticContent', function () {
    it('provides a homepage', (done) => {
      chai.request(messenger.app)
        .get('/')
        .end(function (err, res) {
          assert.equal(res.statusCode, 200);
          done();
        });
    });

    xit('provides a Send to Messenger button', (done) => {
      chai.request(messenger.app)
        .get('/send-to-messenger')
        .end(function (err, res) {
          assert.equal(res.statusCode, 200);
          assert.ok(res.text.includes('fb-send-to-messenger'));
          done();
        });
    });

    xit('provides a Message Us button', (done) => {
      chai.request(messenger.app)
        .get('/send-to-messenger')
        .end(function (err, res) {
          assert.equal(res.statusCode, 200);
          assert.ok(res.text.includes('fb-messengermessageus'));
          done();
        });
    });

    it('provides a departures healthcheck', (done) => {
      chai.request(messenger.app)
        .get('/ping')
        .end(function (err, res) {
          assert.equal(res.statusCode, 200);
          done();
        });
    });

  });

  describe('routeEachMessage session', () => {
    const baseMessage = {
      sender: {id: 'teehee'}
    };
    let messenger;

    beforeEach(() => {
      messenger = new app.Messenger(config);
      sinon.stub(messenger, 'getPublicProfile').returns({then: (resolve) => resolve({})});
    });

    afterEach(() => {
      messenger.getPublicProfile.restore();
    });

    it('counts every message received', () =>
      messenger.routeEachMessage(baseMessage)
        .then(() => messenger.routeEachMessage(baseMessage))
        .then((session) => {
          assert.equal(session.count, 2);
        })
    );

    it('sets lastSeen', () =>
      messenger.routeEachMessage(baseMessage)
        .then((session) => {
          assert.equal(typeof session.lastSeen, 'number');
        })
    );

    it('sets source for auth messages', () => {
      const authMessage = Object.assign({optin: 'foo'}, baseMessage);
      return messenger.routeEachMessage(authMessage)
        .then(() => app.__internals__.cache.get(messenger.getCacheKey(baseMessage.sender.id)))
        .then((session) => {
          assert.equal(session.source, 'web');
        });
    });

    describe('return user', () => {
      let originalValue;

      before(() => {
        originalValue = app.__internals__.SESSION_TIMEOUT_MS;
        app.__internals__.SESSION_TIMEOUT_MS = 0;
      });

      after(() => {
        app.__internals__.SESSION_TIMEOUT_MS = originalValue;
      });

      it('sets source for return user', () =>
        messenger.routeEachMessage(baseMessage)
          .then((session) => {
            session.source = 'foo';
            return messenger.routeEachMessage(baseMessage);
          })
          .then((session) => {
            assert.equal(session.source, 'return');
          })
      );
    });

    it('does not set source for user still in session', () =>
      messenger.routeEachMessage(baseMessage)
        .then((session) => {
          session.source = 'foo this should not change';
          return app.__internals__.cache.set(baseMessage.sender.id, session);
          return app.__internals__.cache.set(messenger.getCacheKey(baseMessage.sender.id), session);
        })
        .then(() => {
          return messenger.routeEachMessage(baseMessage);
        })
        .then((session) => {
          assert.equal(session.source, 'foo this should not change');
        })
    );
  });
});