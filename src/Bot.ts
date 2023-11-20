import {ActivityType, Client, TextChannel} from 'discord.js';
import * as interactionCreate from "./events/interactionCreate";
import * as ready from "./events/ready";
import 'dotenv/config';
import * as process from "process";

const token: string = process.env.DISCORD_TOKEN as string;
const userId: string = process.env.USER_ID as string;
const channelId: string = process.env.CHANNEL_ID as string;

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
    if (newPresence.userId === userId) {
        const activities = newPresence.activities;
        const status = newPresence.status;
        const clientStatus = newPresence.clientStatus;
        const timestamp = new Intl.DateTimeFormat('de-DE', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());

        // Preparing the client status part of the message
        let clientStatusMessage = [];
        if (clientStatus) {
            if (clientStatus.desktop) clientStatusMessage.push(`${clientStatus.desktop} on Desktop :desktop:`);
            if (clientStatus.mobile) clientStatusMessage.push(`${clientStatus.mobile} on Mobile :mobile_phone:`);
            if (clientStatus.web) clientStatusMessage.push(`${clientStatus.web} on Web :globe_with_meridians:`);
        }
        const clientStatusString = clientStatusMessage.join(', ');

        // Combining the status and client status in one line with the title
        let message = `### :boom: Presence Update\n[${timestamp}] Your new activity status is **${status}**. (${clientStatusString})\n`;

        activities.forEach(activity => {
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

        // Actual message
        const channel = client.channels.cache.get(channelId) as TextChannel;

        // Check if the channel is a text channel and then send the message
        if (channel) {
            channel.send(message)
                .catch(console.error); // Catch and log any errors
        } else {
            console.error(`[${timestamp}] Could not find the channel.`);
        }
    }
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
    if (newPresence.userId === userId) {
        const timestamp = new Intl.DateTimeFormat('de-DE', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(new Date());

        newPresence.activities.forEach((activity) => {
            if (activity.type === ActivityType.Listening && activity.name === 'Spotify') {
                const trackName = activity.details;
                const trackArtist = activity.state;
                const trackAlbum = activity.assets?.largeText;

                // Construct the message with the timestamp
                const spotifyMessage = `[${timestamp}] :musical_note: Listening to "**${trackName}**" by "*${trackArtist}*" on the album "*${trackAlbum}*".`;

                // Send to a specific channel
                const channel = client.channels.cache.get(channelId) as TextChannel;
                if (channel) channel.send(spotifyMessage).catch(console.error);
            }
        });
    }
});

client.on(interactionCreate.name, interactionCreate.execute);
client.on(ready.name, () => ready.execute(client));

client.login(token).then(r => console.log(`Logged in as ${client.user?.tag}`)).catch(e => console.error(`Login failed: ${e}`));
