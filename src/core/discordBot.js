/* eslint-disable jsdoc/require-example */

const { BotCommandDeployment } = require("../entities/command");
const {
    findPaths,
    storeFolderPaths,
    readFolderPaths
} = require("@disqada/pathfinder");
const { Client, Collection, Events, GatewayIntentBits } = require("discord.js");
const { BotCommand } = require("../entities/command");
const { BotEvent } = require("../entities/event");
const interactionCreate = require("../events/interactionCreate");
const { ready } = require("../events/ready");
const { Modules, RecordStates } = require("../data/enums");
const { logRecords } = require("./logger");
const { BotConfig } = require("../data/config");
const { resolve, sep } = require("path");

/**
 * @typedef {object} BotOptions
 * @property {string} token The bot application's API token.
 * @property {object} [directories]
 * @property {string} [directories.root] - The path to the folder containing all the bot files.
 * @property {string} [directories.data] - The Path to the directory the json data files.
 * @property {import("discord.js").ClientOptions} client
 */

/**
 * @typedef {object} BotData
 * @property {import("../interface/config").Config} config
 */

/**
 * @class
 * @category Core
 */
class DiscordBot {
    /**
     * @type {BotData}
     */
    data = {
        config: {
            id: {
                guild: {}
            },
            brand: {
                name: "halfbot",
                colour: 0xffffff,
                logoUrl: "https://cdn.discordapp.com/embed/avatars/0.png"
            }
        }
    };

    /**
     * @type {Collection<BotCommand>}
     */
    commands = new Collection();

    /**
     * @type {import("discord.js").Client}
     */
    client;

    /**
     * The initialization of a new DiscordBot.
     * @param {BotOptions} options - Information about the DiscordBot.
     * @param {ClientOptions} options - The bot's client options.
     */
    constructor(
        data,
        options = {
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers
            ]
        }
    ) {
        const data2 = {
            rootDirectory: "bot",
            dataDirectory: "bot/data"
        };
        Object.assign(data2, data);

        // TODO Check token and clientId validity
        this.client = new Client(options);
        this.runBot(data);
    }

    /**
     * Start and connect the bot.
     * @param {BotOptions} options - Information about the DiscordBot.
     * @returns {Promise<void>}
     * @async
     * @private
     */
    async runBot(data) {
        await storeFolderPaths([data.rootDirectory], {
            deepSearch: true
        });
        await this.storeData(data.dataDirectory);
        await this.registerAllModules();
        this.listenToEvents();

        await this.client.login(data.token);
    }

    /**
     * Subscribe to the core events.
     * @returns {void}
     * @private
     */
    listenToEvents() {
        this.client.on(Events.ClientReady, () => ready(this));
        this.client.on(Events.InteractionCreate, (interaction) => {
            interaction.bot = this;
            interactionCreate(interaction);
        });
    }

    /**
     * Inject data from the workspace files.
     * @param {string} dataDirectory - The path to the directory the json data files.
     * @returns {Promise<void>}
     * @async
     */
    async storeData(dataDirectory) {
        const files = await readFolderPaths(resolve(dataDirectory), {
            deepSearch: false
        });
        for (let i = 0; i < files.length; i++) {
            const index1 = files[i].lastIndexOf(sep);
            const index2 = files[i].length - ".json".length;
            const name = files[i].substring(index1 + sep.length, index2);

            const data = require(files[i]);
            if (data) {
                if (name === "config") {
                    Object.assign(this.data.config, data);
                } else {
                    this.data[name] = data;
                }
            }
        }
    }

    /**
     * Register a command inside the bot.
     * @param {import("../entities/command").BotCommand} command - The bot command module.
     * @returns {undefined}
     */
    registerCommand(command) {
        this.commands.set(command.data.name, command);

        return {
            name: command.data.name,
            type: Modules.Commands,
            deployment: command.data.deployment
        };
    }

    /**
     * Register an event inside the bot.
     * @param {import("../entities/event").BotEvent<any>} event - The bot event module.
     * @returns {undefined}
     */
    registerEvent(event) {
        this.client.on(event.data.name, (...args) =>
            event.execute(this, ...args)
        );

        return {
            name: event.data.name,
            type: Modules.Events,
            deployment: BotCommandDeployment.Global
        };
    }

    /**
     * Register bot modules to the client.
     * @returns {Promise<void>}
     * @async
     * @private
     */
    async registerAllModules() {
        const paths = findPaths()
            .filter(
                (fp) =>
                    fp.fullPath.includes(Modules.Commands) ||
                    fp.fullPath.includes(Modules.Events)
            )
            .map((fp) => fp.fullPath);
        if (paths.length === 0) {
            return;
        }

        const records = [[], []];

        for (let i = 0; i < paths.length; i++) {
            const botModule = require(paths[i]);

            if (botModule.data && botModule.data.module) {
                if (
                    botModule.data.module === "command" &&
                    BotCommand.isValid(botModule)
                ) {
                    const record = this.registerCommand(botModule);
                    records[RecordStates.Success].push(record);
                    continue;
                } else if (
                    botModule.data.module === "event" &&
                    BotEvent.isValid(botModule)
                ) {
                    const record = this.registerEvent(botModule);
                    records[RecordStates.Success].push(record);
                    continue;
                }
            }

            const word = "modules";
            const index = paths[i].indexOf(word);
            records[RecordStates.Fail].push({
                path: paths[i].substring(index + word.length + 1),
                message:
                    "The module is invalid, maybe a required property is missing"
            });
        }

        logRecords(records[RecordStates.Success], RecordStates.Success);
        logRecords(records[RecordStates.Fail], RecordStates.Fail);
    }
}

module.exports = {
    DiscordBot
};
