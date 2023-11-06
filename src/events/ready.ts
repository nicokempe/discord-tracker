// src/events/ready.ts
import { Client } from "discord.js";
import { commands } from "../commands";
import process from "process";
import 'dotenv/config';
const guildIdentifier: string = process.env.GUILD_ID as string;

export const name = 'ready';

export const execute = async (client: Client) => {
    console.log(`Logged in as ${client.user?.tag}!`);

    const guildId: string = guildIdentifier;
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
        console.error(`Guild with ID ${guildId} not found.`);
        return;
    }

    // Log registered commands
    const registeredCommands = await guild.commands.fetch();
    console.log('Registered commands:', registeredCommands.map(cmd => cmd.name).join(', '));

    // Create commands
    await Promise.all(
        Object.values(commands).map(async command => {
            const { data } = command;
            try {
                await guild.commands.create(data);
                console.log(`Registered command: ${data.name}`);
            } catch (error) {
                console.error(`Failed to register command ${data.name}:`, error);
            }
        })
    );
};