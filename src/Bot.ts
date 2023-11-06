import {Client, ActivityType, Presence, TextChannel} from 'discord.js';
import * as interactionCreate from "./events/interactionCreate";
import * as ready from "./events/ready";
import 'dotenv/config';
import * as process from "process";
const token: string = process.env.DISCORD_TOKEN as string;

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
    if (newPresence.userId === '406127466680418316') { // Replace with your user ID
        const activities = newPresence.activities;
        const status = newPresence.status;
        const timestamp = new Date().toLocaleString();
        let message = `[${timestamp}] Your new activity status: ${status}\n`;

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
            message += `[${timestamp}] ${type} ${activity.name}\n`;
        });

        // Corrected code for sending message
        const channelId = '1171191130159841290'; // Replace with your channel ID
        const channel = client.channels.cache.get(channelId) as TextChannel;

        // Check if the channel is a text channel and then send the message
        if (channel) {
            channel.send(message)
                .catch(console.error); // Catch and log any errors
        } else {
            console.error('Could not find the channel.');
        }
    }
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
    if (newPresence.userId === '406127466680418316') { // Replace with your user ID
        newPresence.activities.forEach((activity) => {
            if (activity.type === ActivityType.Listening && activity.name === 'Spotify') {
                const trackName = activity.details; // Name of the song
                const trackArtist = activity.state; // Artist of the song
                const trackAlbum = activity.assets?.largeText; // Album of the song

                // Construct the message
                const message = `Listening to ${trackName} by ${trackArtist} on the album ${trackAlbum}.`;

                // Send to a specific channel
                const channelId = '1171191130159841290'; // Replace with your channel ID
                const channel = client.channels.cache.get(channelId) as TextChannel;

                if (channel) {
                    channel.send(message).catch(console.error);
                } else {
                    console.error('Could not find the channel.');
                }
            }
        });
    }
});

client.on(interactionCreate.name, interactionCreate.execute);
client.on(ready.name, () => ready.execute(client));

client.login(token).then(r => console.log(`Logged in as ${client.user?.tag}`)).catch(e => console.error(`Login failed: ${e}`));
