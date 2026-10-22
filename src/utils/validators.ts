import { Status, type Client, type WebSocketShard } from 'discord.js';

/** Checks live shard states because client readiness can remain true during reconnects. */
export const isDiscordGatewayReady = (client: Client): boolean =>
  client.isReady() && client.ws.shards.size > 0
  && client.ws.shards.every((shard: WebSocketShard): boolean => shard.status === Status.Ready);
