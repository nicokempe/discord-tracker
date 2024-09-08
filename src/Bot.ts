import { ActivityType, Client, MessageCreateOptions, MessagePayload, TextChannel } from 'discord.js';
import * as interactionCreate from "./events/interactionCreate";
import { ready } from './events/ready';
import 'dotenv/config';
import * as process from "process";
import * as fs from 'fs';

const token: string = process.env.DISCORD_TOKEN as string;

// Load users from users.json
const usersConfig = JSON.parse(fs.readFileSync('./config/users.json', 'utf-8'));
type UserConfig = { userId: string, channelId: string, isFanClub: boolean, prefix: string };

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

client.on('ready', () => {
    const updateStatus = () => {
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
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

client.on('presenceUpdate', (oldPresence, newPresence) => {
    const timestamp = new Intl.DateTimeFormat('de-DE', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date());

    const createPresenceMessage = (newPresence: any, userConfig: UserConfig) => {
        const activities = newPresence.activities;
        const status = newPresence.status;
        const clientStatus = newPresence.clientStatus;

        let clientStatusMessage = [];
        if (clientStatus) {
            if (clientStatus.desktop) clientStatusMessage.push(`${clientStatus.desktop} on Desktop :desktop:`);
            if (clientStatus.mobile) clientStatusMessage.push(`${clientStatus.mobile} on Mobile :mobile_phone:`);
            if (clientStatus.web) clientStatusMessage.push(`${clientStatus.web} on Web :globe_with_meridians:`);
        }
        const clientStatusString = clientStatusMessage.join(', ');

        let message: string | MessagePayload | MessageCreateOptions;
        if (userConfig.isFanClub) {
            message = `### ${userConfig.prefix} ${newPresence.user?.tag}'s activity update\n[${timestamp}] The new activity status is **${status}**. (${clientStatusString})\n`;
        } else {
            message = `### ${userConfig.prefix} Your new activity status is **${status}**. (${clientStatusString})\n`;
        }

        activities.forEach((activity: { type: any; name: any; }) => {
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

        const channel = client.channels.cache.get(userConfig.channelId) as TextChannel;
        if (channel) {
            channel.send(message).catch(console.error);
        } else {
            console.error(`[${timestamp}] Could not find the channel.`);
        }
    };

    const spotifyIntegration = (newPresence: any, userConfig: UserConfig) => {
        newPresence.activities.forEach((activity: any) => {
            if (activity.type === ActivityType.Listening && activity.name === 'Spotify') {
                const trackName = activity.details;
                const trackArtist = activity.state;
                const trackAlbum = activity.assets?.largeText;

                const spotifyMessage = `[${timestamp}] :musical_note: Listening to "**${trackName}**" by "*${trackArtist}*" on the album "*${trackAlbum}*".`;

                const channel = client.channels.cache.get(userConfig.channelId) as TextChannel;
                if (channel) channel.send(spotifyMessage).catch(console.error);
            }
        });
    };

    usersConfig.users.forEach((userConfig: UserConfig) => {
        if (newPresence.userId === userConfig.userId) {
            createPresenceMessage(newPresence, userConfig);
            spotifyIntegration(newPresence, userConfig);
        }
    });

});

client.on(interactionCreate.name, interactionCreate.execute);
client.once(ready.name, () => ready.execute(client));

client.login(token).then(r => console.log(`Logged in as ${client.user?.tag}`)).catch(e => console.error(`Login failed: ${e}`));
