import { ActivityType, Client, MessageCreateOptions, MessagePayload, TextChannel} from 'discord.js';
import * as interactionCreate from "./events/interactionCreate";
import {ready} from './events/ready';
import 'dotenv/config';
import * as process from "process";

const token: string = process.env.DISCORD_TOKEN as string;
const userId: string = process.env.USER_ID as string;
const channelId: string = process.env.CHANNEL_ID as string;
const mainUserId: string = process.env.MAIN_USER_ID as string;
const fanClubChannelId: string = process.env.FAN_CLUB_CHANNEL_ID as string;

type Status = {
    name: string;
    type: keyof typeof ActivityType;
};

const statuses: Status[] = [
    {name: 'automations', type: 'Playing'},
    {name: 'code', type: 'Playing'},
    {name: 'networking', type: 'Playing'},
    {name: 'consulting', type: 'Playing'},
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
            client.user?.setActivity(randomStatus.name, {type: ActivityType[randomStatus.type]});
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

    const createPresenceMessage = (newPresence: any, channelId: string, prefix: string, isFanClub: boolean) => {
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
        if (isFanClub) {
            message = `### ${prefix} ${newPresence.user?.tag}'s activity update\n[${timestamp}] The new activity status is **${status}**. (${clientStatusString})\n`;
        } else {
            message = `### ${prefix} Your new activity status is **${status}**. (${clientStatusString})\n`;
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
            if (isFanClub) {
                message += `[${timestamp}] *${type}* **${activity.name}**\n`;
            } else {
                message += `[${timestamp}] *${type}* **${activity.name}**\n`;
            }
        });

        const channel = client.channels.cache.get(channelId) as TextChannel;
        if (channel) {
            channel.send(message).catch(console.error);
        } else {
            console.error(`[${timestamp}] Could not find the channel.`);
        }
    };

    if (newPresence.userId === userId) {
        createPresenceMessage(newPresence, channelId, ':boom:', false);
    }

    if (newPresence.userId === mainUserId) {
        createPresenceMessage(newPresence, fanClubChannelId, ':star:', true);
    }
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
    if (newPresence.userId === userId || newPresence.userId === mainUserId) {
        const timestamp = new Intl.DateTimeFormat('de-DE', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());

        newPresence.activities.forEach((activity) => {
            if (activity.type === ActivityType.Listening && activity.name === 'Spotify') {
                const trackName = activity.details;
                const trackArtist = activity.state;
                const trackAlbum = activity.assets?.largeText;

                const spotifyMessage = `[${timestamp}] :musical_note: Listening to "**${trackName}**" by "*${trackArtist}*" on the album "*${trackAlbum}*".`;

                const targetChannelId = newPresence.userId === userId ? channelId : fanClubChannelId;
                const channel = client.channels.cache.get(targetChannelId) as TextChannel;
                if (channel) channel.send(spotifyMessage).catch(console.error);
            }
        });
    }
});

client.on(interactionCreate.name, interactionCreate.execute);
client.once(ready.name, () => ready.execute(client));

client.login(token).then(r => console.log(`Logged in as ${client.user?.tag}`)).catch(e => console.error(`Login failed: ${e}`));
