import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteraction } from 'discord.js';

const helloThere = {
    data: new SlashCommandBuilder()
        .setName('hello_there')
        .setDescription('Replies with General Kenobi'),
    async execute(interaction: CommandInteraction) {
        await interaction.reply('General Kenobi');
    },
};

export default helloThere;
