import { ActivityType, Client, MessageCreateOptions, MessagePayload, TextChannel, PermissionFlagsBits } from 'discord.js';
import { ready } from './events/ready';
import 'dotenv/config';
import * as process from "process";
import * as fs from 'fs';

const token: string = process.env.DISCORD_TOKEN as string;

// Load users from users.json
const usersConfig = JSON.parse(fs.readFileSync('./config/users.json', 'utf-8'));
type UserConfig = {
    userId: string,
    channelId: string,
    broadcast: boolean,
    prefix: string,
    mentionUser: boolean
};

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
    const updateStatus: () => void = (): void => {
        const randomStatus: Status = statuses[Math.floor(Math.random() * statuses.length)];
        try {
            client.user?.setActivity(randomStatus.name, { type: ActivityType[randomStatus.type] });
            console.log(`Updated status to: ${randomStatus.name}`);
        } catch (error) {
            console.error(`Failed to update status: ${(error as Error).message}`);
        }
    };

    updateStatus();  // Update status immediately when bot is ready
    setInterval(updateStatus, 3600000);  // Update status every hour thereafter
});

client.on('presenceUpdate', (oldPresence, newPresence): void => {
    const timestamp: string = new Intl.DateTimeFormat('de-DE', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date());

    const createPresenceMessage = (newPresence: any, userConfig: UserConfig): void => {
        const activities = newPresence.activities;
        const status = newPresence.status;
        const clientStatus = newPresence.clientStatus;

        let clientStatusMessage = [];
        if (clientStatus) {
            if (clientStatus.desktop) clientStatusMessage.push(`${clientStatus.desktop} on Desktop :desktop:`);
            if (clientStatus.mobile) clientStatusMessage.push(`${clientStatus.mobile} on Mobile :mobile_phone:`);
            if (clientStatus.web) clientStatusMessage.push(`${clientStatus.web} on Web :globe_with_meridians:`);
        }
        const clientStatusString: string = clientStatusMessage.join(', ');

        // Use mention if 'mentionUser' is true, otherwise use the username
        const userTag = userConfig.mentionUser ? `<@${newPresence.userId}>` : newPresence.user?.tag;

        let message: string | MessagePayload | MessageCreateOptions;
        if (userConfig.broadcast) {
            message = `### ${userConfig.prefix} Activity update for ${userTag}\n[${timestamp}] The new activity status is **${status}**. (${clientStatusString})\n`;
        } else {
            message = `### ${userConfig.prefix} Your new activity status is **${status}**. (${clientStatusString})\n`;
        }

        activities.forEach((activity: { type: any; name: any; }): void => {
            let type;
            switch (activity.type) {
                case 0: type = 'Playing'; break;
                case 1: type = 'Streaming'; break;
                case 2: type = 'Listening to'; break;
                case 3: type = 'Watching'; break;
                case 4: type = 'Custom Status'; break;
                default: type = 'Unknown'; break;
            }
            message += `[${timestamp}] *${type}* **${activity.name}**\n`;
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

        channel.send(message).catch(error => {
            console.error(`[${timestamp}] Failed to send presence message in channel ${channel.id}: ${error}`);
        });
    };

    const spotifyIntegration = (newPresence: any, userConfig: UserConfig): void => {
        newPresence.activities.forEach((activity: any): void => {
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

    usersConfig.users.forEach((userConfig: UserConfig): void => {
        if (newPresence.userId === userConfig.userId) {
            createPresenceMessage(newPresence, userConfig);
            spotifyIntegration(newPresence, userConfig);
        }
    });

});

client.once(ready.name, (): Promise<void> => ready.execute(client));

client.login(token).then(r => console.log(`Logged in as ${client.user?.tag}`)).catch(e => console.error(`Login failed: ${e}`));
