/* eslint-disable jsdoc/require-example */
/**
 * @file
 * @ignore
 */

const { BotCommandDeployment } = require("../entities/command");

/**
 * Get the correct server ID.
 * @param {BotCommandData} data - The command data deciding where to register the command.
 * @param {BotConfig} guildIds - The container of the server IDs.
 * @returns {string} The server ID.
 * @private
 * @throws {Error} - if data.deployment wasn't of the enum values.
 */
function getGuildId(data, guildIds) {
    const globalGuildId = "0";

    switch (data.deployment) {
        case BotCommandDeployment.Global:
            return globalGuildId;

        case BotCommandDeployment.DevGuild:
            return guildIds.dev ?? globalGuildId;

        case BotCommandDeployment.SupportGuild:
            return guildIds.support ?? globalGuildId;

        default:
            throw new Error(
                "Unknown BotCommandDeployment value: " + data.deployment
            );
    }
}

/**
 * Preparing the bot commands for registration.
 * @param {DiscordBot} bot - The bot to register the commands for.
 * @returns {undefined}
 * @private
 */
function prepareCommands(bot) {
    const commands = new Map();

    for (const iterator of bot.commands) {
        const command = iterator[1];
        const guildId = getGuildId(command.data, bot.data.config.id.guild);

        const commandArray = commands.get(guildId) ?? [];
        commandArray.push(command.data);
        commands.set(guildId, commandArray);
    }

    return commands;
}

/**
 * Register the commands via the API.
 * @param {Client} client - The client to register the commands for.
 * @param {Map<BotCommand>} commandMap - The commands to register.
 * @returns {Promise<undefined>}
 * @private
 */
async function registerCommands(client, commandMap) {
    for (const iterator of commandMap) {
        const commandsData = iterator[1];
        const guildId = iterator[0];

        if (guildId === "0") {
            await client.application?.commands.set(commandsData);
        } else {
            await client.guilds.cache.get(guildId)?.commands.set(commandsData);
        }
    }
}

/**
 * The client is ready and has connected successfully.
 * @param {DiscordBot} bot - The bot of the client.
 * @returns {undefined}
 * @private
 */
async function ready(bot) {
    const commands = prepareCommands(bot);
    await registerCommands(bot.client, commands);

    console.log(`The bot "${bot.client.user.username}" is online`);

    bot.client.user.setPresence({
        status: "online",
        activities: [
            {
                name: "Operating ...",
                url: "https://github.com/DisQada/halfbot"
            }
        ]
    });
}

module.exports = ready;
