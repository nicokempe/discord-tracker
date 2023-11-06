import { Interaction } from "discord.js";
import { commands } from "../commands";

export const name = 'interactionCreate';

export const execute = async (interaction: Interaction) => {
    if (!interaction.isCommand()) return;

    console.log('Received interaction:', interaction);

    const { commandName } = interaction;
    const command = Object.values(commands).find(cmd => cmd.data.name === commandName);

    if (command) await command.execute(interaction);
};
