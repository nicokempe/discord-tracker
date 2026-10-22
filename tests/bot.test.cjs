const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { EventEmitter } = require('node:events');
const { runInNewContext } = require('node:vm');
const { test } = require('node:test');
const { Client: DiscordClient, Collection, Status: GatewayStatus, WebSocketShard } = require('discord.js');
const { isDiscordGatewayReady } = require('../dist/utils/validators.js');

/** Executes the built entry point with an isolated Discord client and configuration. */
const loadBot = async ({ canSend = true, loginFails = false, broadcast = true, mentionUser = true, processModule } = {}) => {
  const messages = [];
  const exits = [];
  const handlers = new Map();
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
    ws = { status: 0, shards: new Collection([[0, { status: 0 }]]) };
    channels = { cache: new Map([['channel', new TextChannel()]]) };
    user = { tag: 'Tracker#0001', setActivity: () => {} };
    constructor() { client = this; }
    on(name, handler) { handlers.set(name, [...(handlers.get(name) ?? []), handler]); }
    once(name, handler) { this.on(name, handler); }
    isReady() { return this.ready; }
    async login() { if (loginFails) throw new Error('login failed'); }
    async destroy() { this.destroyed = true; }
  }
  const fakeProcess = Object.assign(new EventEmitter(), {
    env: { DISCORD_TOKEN: 'test-token' },
    exit: code => { exits.push(code); },
  });
  const runtimeProcess = processModule ?? fakeProcess;
  const modules = {
    'discord.js': { Client, TextChannel, ActivityType: { Playing: 0, Listening: 2 }, PermissionFlagsBits: { SendMessages: 1n }, Status: { Ready: 0 } },
    './events/clientReady': { clientReady: { name: 'clientReady', execute: async () => {} } },
    './health': { startHealthServer: async check => { readiness = check; return { close: () => { closed = true; } }; } },
    './utils/validators': { isDiscordGatewayReady },
    'dotenv/config': {},
    process: runtimeProcess,
    'node:process': runtimeProcess,
    fs: { readFileSync: () => JSON.stringify({ users: [{ userId: 'tracked', channelId: 'channel', broadcast, prefix: ':star:', mentionUser }] }) },
  };
  runInNewContext(readFileSync(require.resolve('../dist/Bot.js'), 'utf8'), {
    exports: {},
    require: name => Object.hasOwn(modules, name) ? modules[name] : require(name),
    process: runtimeProcess,
    console: { log: () => {}, error: () => {} },
    setInterval: () => 0,
  });
  await new Promise(resolve => setImmediate(resolve));
  return { client, messages, exits, handlers, process: runtimeProcess, readiness, isClosed: () => closed };
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

test('compiled startup registers signal handlers with the real Node process', async () => {
  const signalNames = ['SIGTERM', 'SIGINT'];
  const previousListeners = new Map(signalNames.map(signal => [signal, new Set(process.rawListeners(signal))]));
  try {
    const bot = await loadBot({ processModule: require('node:process') });
    assert.equal(typeof bot.readiness, 'function');
    for (const signal of signalNames) {
      assert.equal(process.listenerCount(signal), previousListeners.get(signal).size + 1);
    }
  } finally {
    for (const signal of signalNames) {
      for (const listener of process.rawListeners(signal)) {
        if (!previousListeners.get(signal).has(listener)) process.removeListener(signal, listener);
      }
    }
  }
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
  bot.client.ws.shards.get(0).status = 5;
  assert.equal(bot.readiness(), false);
  bot.client.ws.shards.get(0).status = 0;
  assert.equal(bot.readiness(), true);
  bot.process.emit('SIGTERM');
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

test('rejects reconnecting shards while real Discord.js client readiness remains true', () => {
  const client = new DiscordClient({ intents: [] });
  assert.equal(isDiscordGatewayReady(client), false);
  client.ws.status = GatewayStatus.Ready;
  assert.equal(client.isReady(), true);
  assert.equal(isDiscordGatewayReady(client), false);
  client.ws.shards.set(0, new WebSocketShard(client.ws, 0));
  client.ws.shards.set(1, new WebSocketShard(client.ws, 1));
  for (const shard of client.ws.shards.values()) shard.status = GatewayStatus.Ready;
  assert.equal(isDiscordGatewayReady(client), true);
  for (const status of [GatewayStatus.Connecting, GatewayStatus.Identifying, GatewayStatus.Resuming, GatewayStatus.Disconnected]) {
    client.ws.shards.get(1).status = status;
    assert.equal(client.isReady(), true);
    assert.equal(isDiscordGatewayReady(client), false);
  }
  client.ws.shards.get(1).status = GatewayStatus.Ready;
  assert.equal(isDiscordGatewayReady(client), true);
  client.ws.shards.clear();
});
