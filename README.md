![Header](.github/gh-header-image.png)

### 🚀 Introduction
Welcome to the Discord Activity Tracker Bot repository. This advanced bot provides real-time tracking and broadcasting of user activities on Discord, including special integrations for music tracking via Spotify.

### ⏱️ Features
* **Activity Tracking**: Tracks what users are playing, listening to, or watching in real-time.
* **Spotify Integration**: Displays details about songs being played on Spotify.
* **Custom Status Updates**: Updates user status based on their current activity.
* **Docker Support**: Easy to deploy and manage using Docker.

### 💻 Technologies

This bot is developed using:
* [Discord.js](https://discord.js.org/)
* [Node.js](https://nodejs.org/en)
* [TypeScript](https://www.typescriptlang.org/)
* [Docker](https://www.docker.com/) for simplified deployment


### 🐳 Installation and Setup

To set up the Discord Activity Tracker Bot, follow these instructions:

1. **Clone the Repository**: 
   Clone the repository to your machine or server.
   ```bash
   git clone https://github.com/nicokempe/robot.git
   ```

3. **Set Up Environment Variables**: 
- Copy the `.env.example` file to a new file named `.env`.

  ```bash
  cp .env.example .env
  ```

- Edit the `.env` file and replace the placeholder values with your actual Discord bot token, user ID, and the channel ID where messages will be posted.
  ```env
  DISCORD_TOKEN=your_actual_discord_bot_token
  GUILD_ID=your_guild_id
  USER_ID=your_discord_user_id
  CHANNEL_ID=your_discord_channel_id
  ```
3. **Docker Setup**: 
Make sure Docker is installed on your system. Use the `Dockerfile` and `docker-compose.yml` to build and run the bot.

### 🚀 Usage

After setting up, the bot will automatically start tracking your Discord activities and update its status. It will also post updates about your activities in the designated Discord channel. Ensure the bot has the necessary permissions in your Discord server to function properly.

### 📝 Contributing

Contributions to the Discord Activity Tracker Bot are welcome. Please feel free to fork the repository, make your changes, and submit a pull request. For major changes, please open an issue first to discuss what you would like to change.

### 📜 License

This project is licensed under the MIT License - see the LICENSE file for details.
