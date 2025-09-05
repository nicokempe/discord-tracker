import { Client } from 'discord.js';
import { REST } from '@discordjs/rest';

/**
 * Emitted when the client becomes ready to start working.
 */
export const clientReady = {
  name: 'clientReady',
    once: true,
    /**
     * Event handler executed when the bot becomes ready.
     * @param client The Discord client instance.
     */
    async execute(client: Client): Promise<void> {
        if (!client.user) {
            console.error('Client user is null');
            return;
        }

        console.log(`Logged in as ${client.user.tag}!`);

        const botToken = process.env.DISCORD_TOKEN;
        if (!botToken) {
            console.error('Discord bot token is undefined');
            return;
        }

        const restClient: REST = new REST({ version: '10' }).setToken(botToken);
    },
};
