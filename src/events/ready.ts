import { Client } from 'discord.js';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { commands } from '../commands';

export const ready = {
    name: 'ready',
    once: true,
    async execute(client: Client) {
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

        const rest = new REST({ version: '9' }).setToken(token);

        try {
            console.log('Started refreshing application (/) commands.');

            const commandData = Object.values(commands).map((command) => command.data.toJSON());

            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commandData }
            );

            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error(error);
        }
    },
};
