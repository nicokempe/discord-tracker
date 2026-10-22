const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');

/** Executes the built entry point with an isolated Discord client and configuration. */
const loadBot = async ({ canSend = true, loginFails = false, broadcast = true, mentionUser = true } = {}) => {
  const messages = [];
  const exits = [];
  const handlers = new Map();
  const signals = new Map();
  let client;
  let readiness;
  let closed = false;
  class TextChannel {
    id = 'channel';
    permissionsFor() { return { has: () => canSend }; }
    async send(message) { messages.push(message); }
  }
  class Client {
    ready = false;
    destroyed = false;
    ws = { status: 0 };
    channels = { cache: new Map([['channel', new TextChannel()]]) };
    user = { tag: 'Tracker#0001', setActivity: () => {} };
    constructor() { client = this; }
    on(name, handler) { handlers.set(name, [...(handlers.get(name) ?? []), handler]); }
    once(name, handler) { this.on(name, handler); }
    isReady() { return this.ready; }
    async login() { if (loginFails) throw new Error('login failed'); }
    async destroy() { this.destroyed = true; }
  }
  const fakeProcess = {
    env: { DISCORD_TOKEN: 'test-token' },
    once: (signal, handler) => signals.set(signal, handler),
    exit: code => { exits.push(code); },
  };
  const modules = {
    'discord.js': { Client, TextChannel, ActivityType: { Playing: 0, Listening: 2 }, PermissionFlagsBits: { SendMessages: 1n }, Status: { Ready: 0 } },
    './events/clientReady': { clientReady: { name: 'clientReady', execute: async () => {} } },
    './health': { startHealthServer: async check => { readiness = check; return { close: () => { closed = true; } }; } },
    'dotenv/config': {},
    process: fakeProcess,
    fs: { readFileSync: () => JSON.stringify({ users: [{ userId: 'tracked', channelId: 'channel', broadcast, prefix: ':star:', mentionUser }] }) },
  };
  runInNewContext(readFileSync(require.resolve('../dist/Bot.js'), 'utf8'), {
    exports: {},
    require: name => Object.hasOwn(modules, name) ? modules[name] : require(name),
    process: fakeProcess,
    console: { log: () => {}, error: () => {} },
    setInterval: () => 0,
  });
  await new Promise(resolve => setImmediate(resolve));
  return { client, messages, exits, handlers, signals, readiness, isClosed: () => closed };
};

/** Builds a tracked presence with both a regular activity and Spotify details. */
const createPresence = (userId = 'tracked') => ({
  userId,
  user: { tag: 'Listener#0001' },
  status: 'online',
  clientStatus: { desktop: 'online', mobile: 'idle' },
  activities: [
    { type: 0, name: 'Example game' },
    { type: 2, name: 'Spotify', details: 'Example track', state: 'Example artist', assets: { largeText: 'Example album' } },
  ],
});

test('preserves activity broadcasts and Spotify details after dependency upgrades', async () => {
  const bot = await loadBot();
  bot.handlers.get('presenceUpdate')[0](null, createPresence());
  assert.equal(bot.messages.length, 2);
  assert.match(bot.messages[0], /Activity update for <@tracked>/);
  assert.match(bot.messages[0], /online on Desktop/);
  assert.match(bot.messages[0], /idle on Mobile/);
  assert.match(bot.messages[0], /Example game/);
  assert.match(bot.messages[1], /Example track.*Example artist.*Example album/);
});

test('preserves private wording and skips users outside the configuration', async () => {
  const bot = await loadBot({ broadcast: false, mentionUser: false });
  bot.handlers.get('presenceUpdate')[0](null, createPresence('untracked'));
  assert.equal(bot.messages.length, 0);
  bot.handlers.get('presenceUpdate')[0](null, createPresence());
  assert.match(bot.messages[0], /Your new activity status/);
  assert.doesNotMatch(bot.messages[0], /<@tracked>/);
});

test('does not send activity or Spotify notifications without permission', async () => {
  const bot = await loadBot({ canSend: false });
  bot.handlers.get('presenceUpdate')[0](null, createPresence());
  assert.equal(bot.messages.length, 0);
});

test('readiness requires both client readiness and a connected gateway', async () => {
  const bot = await loadBot();
  assert.equal(bot.readiness(), false);
  bot.client.ready = true;
  assert.equal(bot.readiness(), true);
  bot.client.ws.status = 5;
  assert.equal(bot.readiness(), false);
  bot.client.ws.status = 0;
  assert.equal(bot.readiness(), true);
  bot.signals.get('SIGTERM')();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bot.isClosed(), true);
  assert.equal(bot.client.destroyed, true);
  assert.deepEqual(bot.exits, [0]);
});

test('failed login closes readiness and exits non-zero for the restart policy', async () => {
  const bot = await loadBot({ loginFails: true });
  assert.equal(bot.isClosed(), true);
  assert.equal(bot.client.destroyed, true);
  assert.deepEqual(bot.exits, [1]);
});
