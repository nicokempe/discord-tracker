import { CommandInteraction, SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("hello_there")
    .setDescription("Returns a greeting");

export async function execute(interaction: CommandInteraction) {
    const content: string = "General Kenobi!";
    await interaction.reply({ ephemeral: true, content });
}
