import {
  Activity,
  ActivityType,
  Client,
  MessageCreateOptions,
  MessagePayload,
  PermissionFlagsBits,
  Presence,
  TextChannel,
} from 'discord.js';
import { ready } from './events/ready';
import 'dotenv/config';
import * as process from "process";
import * as fs from 'fs';

const discordToken: string = process.env.DISCORD_TOKEN as string;

// Load users from users.json
const userConfigs = JSON.parse(fs.readFileSync('./config/users.json', 'utf-8')) as { users: UserConfig[] };

/** Configuration for a tracked user. */
type UserConfig = {
  userId: string;
  channelId: string;
  broadcast: boolean;
  prefix: string;
  mentionUser: boolean;
};

/** Activity status used for rotating the bot's presence. */
type Status = {
  name: string;
  type: keyof typeof ActivityType;
};

const statuses: Status[] = [
  { name: 'automations', type: 'Playing' },
  { name: 'code', type: 'Playing' },
  { name: 'networking', type: 'Playing' },
  { name: 'consulting', type: 'Playing' },
];

const client = new Client({
  intents: [
    "Guilds",
    "GuildMessages",
    "GuildPresences"
  ],
});

client.on('ready', (): void => {
  /** Update the bot's status to a random activity. */
  const updateBotStatus = (): void => {
    const randomStatus: Status = statuses[Math.floor(Math.random() * statuses.length)];
    try {
      client.user?.setActivity(randomStatus.name, { type: ActivityType[randomStatus.type] });
      console.log(`Updated status to: ${randomStatus.name}`);
    } catch (error) {
      console.error(`Failed to update status: ${(error as Error).message}`);
    }
  };

  updateBotStatus(); // Update status immediately when bot is ready
  setInterval(updateBotStatus, 3600000); // Update status every hour thereafter
});

client.on('presenceUpdate', (oldPresence: Presence | null, newPresence: Presence): void => {
  const timestamp: string = new Intl.DateTimeFormat('de-DE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(new Date());

  /**
   * Send a message summarizing the user's presence update.
   */
  const sendPresenceUpdate = (presence: Presence, userConfig: UserConfig): void => {
    const activities = presence.activities;
    const status = presence.status;
    const clientStatus = presence.clientStatus;

    const deviceStatusMessages: string[] = [];
    if (clientStatus) {
      if (clientStatus.desktop) deviceStatusMessages.push(`${clientStatus.desktop} on Desktop :desktop:`);
      if (clientStatus.mobile) deviceStatusMessages.push(`${clientStatus.mobile} on Mobile :mobile_phone:`);
      if (clientStatus.web) deviceStatusMessages.push(`${clientStatus.web} on Web :globe_with_meridians:`);
    }
    const deviceStatusSummary: string = deviceStatusMessages.join(', ');

    // Use mention if 'mentionUser' is true, otherwise use the username
    const userTag = userConfig.mentionUser ? `<@${presence.userId}>` : presence.user?.tag;

    let activityMessage: string | MessagePayload | MessageCreateOptions;
    if (userConfig.broadcast) {
      activityMessage = `### ${userConfig.prefix} Activity update for ${userTag}\n[${timestamp}] The new activity status is **${status}**. (${deviceStatusSummary})\n`;
    } else {
      activityMessage = `### ${userConfig.prefix} Your new activity status is **${status}**. (${deviceStatusSummary})\n`;
    }

    activities.forEach((activity: Activity): void => {
      let activityTypeLabel: string;
      switch (activity.type) {
        case 0: activityTypeLabel = 'Playing'; break;
        case 1: activityTypeLabel = 'Streaming'; break;
        case 2: activityTypeLabel = 'Listening to'; break;
        case 3: activityTypeLabel = 'Watching'; break;
        case 4: activityTypeLabel = 'Custom Status'; break;
        default: activityTypeLabel = 'Unknown'; break;
      }
      activityMessage += `[${timestamp}] *${activityTypeLabel}* **${activity.name}**\n`;
    });

    const channel = client.channels.cache.get(userConfig.channelId);
    if (!channel || !(channel instanceof TextChannel)) {
      console.error(`[${timestamp}] Could not find the channel with ID ${userConfig.channelId}.`);
      return;
    }

    const botUser = client.user;
    if (!botUser) {
      console.error(`[${timestamp}] Client user is not available.`);
      return;
    }

    const permissions = channel.permissionsFor(botUser);
    if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
      console.error(`[${timestamp}] Missing permission to send messages in channel ${channel.id}.`);
      return;
    }

    channel.send(activityMessage).catch(error => {
      console.error(`[${timestamp}] Failed to send presence message in channel ${channel.id}: ${error}`);
    });
  };

  /**
   * Broadcast Spotify listening activity if present.
   */
  const handleSpotifyActivity = (presence: Presence, userConfig: UserConfig): void => {
    presence.activities.forEach((activity: Activity): void => {
      if (activity.type === ActivityType.Listening && activity.name === 'Spotify') {
        const trackName = activity.details;
        const trackArtist = activity.state;
        const trackAlbum = activity.assets?.largeText;

        const spotifyMessage = `[${timestamp}] :musical_note: Listening to "**${trackName}**" by "*${trackArtist}*" on the album "*${trackAlbum}*".`;

        const channel = client.channels.cache.get(userConfig.channelId);
        if (!channel || !(channel instanceof TextChannel)) {
          console.error(`[${timestamp}] Could not find the channel with ID ${userConfig.channelId}.`);
          return;
        }

        const botUser = client.user;
        if (!botUser) {
          console.error(`[${timestamp}] Client user is not available.`);
          return;
        }

        const permissions = channel.permissionsFor(botUser);
        if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
          console.error(`[${timestamp}] Missing permission to send messages in channel ${channel.id}.`);
          return;
        }

        channel.send(spotifyMessage).catch(error => {
          console.error(`[${timestamp}] Failed to send Spotify message in channel ${channel.id}: ${error}`);
        });
      }
    });
  };

  userConfigs.users.forEach((userConfig: UserConfig): void => {
    if (newPresence.userId === userConfig.userId) {
      sendPresenceUpdate(newPresence, userConfig);
      handleSpotifyActivity(newPresence, userConfig);
    }
  });

});

client.once(ready.name, (): Promise<void> => ready.execute(client));

client.login(discordToken).then(r => console.log(`Logged in as ${client.user?.tag}`)).catch(e => console.error(`Login failed: ${e}`));
