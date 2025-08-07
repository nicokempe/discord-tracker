import { Client } from 'discord.js';
import { REST } from '@discordjs/rest';

export const ready = {
    name: 'ready',
    once: true,
    async execute(client: Client): Promise<void> {
        if (!client.user) {
            console.error('Client user is null');
            return;
        }

        console.log(`Logged in as ${client.user.tag}!`);

        const token = process.env.DISCORD_TOKEN;
        if (!token) {
            console.error('Discord bot token is undefined');
            return;
        }

        const rest: REST = new REST({ version: '10' }).setToken(token);
    },
};
