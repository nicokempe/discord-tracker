import { CommandInteraction, SlashCommandBuilder } from "discord.js";

const jokes = [
    "Why did Anakin Skywalker cross the road? To get to the Dark Side.",
    "Why did the angry Jedi cross the road? To get to the Dark Side.",
    "Which program do Jedi use to open PDF files? Adobe Wan Kenobi.",
    "Which website did Chewbacca get arrested for creating? Wookieeleaks.",
    "Why did the scarecrow win an award? Because he was outstanding in his field, just like Luke Skywalker!",
    "Why did Anakin Skywalker cross the road? To get to the Dark Side.",
    "Why did the angry Jedi cross the road? To get to the Dark Side.",
    "Which program do Jedi use to open PDF files? Adobe Wan Kenobi.",
    "Which website did Chewbacca get arrested for creating? Wookieeleaks.",
    "Why did the scarecrow win an award? Because he was outstanding in his field, just like Luke Skywalker!",
    "How does Darth Vader like his toast? On the dark side.",
    "What's a Jedi's favorite dessert? Obi-Wan Cannoli.",
    "Why did the movies come out 4, 5, 6, 1, 2, 3? Because in charge of scheduling, Yoda was.",
    "Why do Siths always carry a spare pair of pants? In case of a dark side accident.",
    "What do you call a pirate droid? Arrrrgh-2-D2!",
    "What do you call a Jedi’s favorite dessert? A Sith-kebab!",
    "Why did the Jedi break up with his girlfriend? Because she was always Sith-ing on the fence!",
    "How did Darth Vader know what Luke got him for Christmas? He felt his presents!",
    "What's the internal temperature of a Tauntaun? Lukewarm.",
    "What do you call the website Chewbacca started that gives out Empire secrets? WookieeLeaks.",
    "What's a Jedi's favorite Italian dish? Veal Yoda.",
    "Why did the Ewok fall out of the tree? Because it was dead.",
    "Why did Yoda turn down a programming job? Because he didn't want to work on the dark side.",
    "How does Wicket get around Endor? Ewoks.",
    "What did the rancor say after eating a Wookiee? Chewie!",
];

export const data = new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Tells a random Star Wars joke');

export async function execute(interaction: CommandInteraction) {
    const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
    await interaction.reply({ ephemeral: true, content: randomJoke });
}
