var config = require('./config.js');

var Articles = {
    //This contains a map of commands supported by help, and their associated help document
    Manifest: [
        {cmd: "wowis,!wowis", docMap: "Commands.wowis"},
        {cmd: "amr,!amr", docMap: "Commands.amr"},
        {cmd: "list", docMap: "List"},
        {cmd: "realm, !realm", docMap: "Commands.realm"},
        {cmd: "wowhead, !wowhead", docMap: "Commands.wowhead"}
    ],

    List: [
        "\x0311"+"Available Help Docs:",
        "wowis, amr, realm, wowhead"
    ],

    //WoWIRCBot command documentation
    Commands: {
        wowis: [
            "\x0311"+"Syntax: !wowis <Character> [<Realm>] [<Region>]",
            "This command will generate a link to the official Battle.net armory page for the requested character.",
            "The realm and region are optional, they will default to the following: ",
                "Realm: \x0303"+config.wow.homeRealm+"\x0302   Region: \x0303"+config.wow.homeRegion,
            "\x0315"+"Whisper this command to the bot for a private response!" ],
        amr: [
            "\x0311"+"Syntax: !amr <Character> [<Realm>] [<Region>]",
            "This command will generate a link to AskMrRobot Gear Optimizer for the requested character.",
            "The realm and region are optional, they will default to the following: ",
            "Realm: \x0303"+config.wow.homeRealm+"\x0302   Region: \x0303"+config.wow.homeRegion,
            "\x0315"+"Whisper this command to the bot for a private response!" ],
        realm: [
            "\x0311"+"Syntax: !realm [<Realm>] [<Region>]",
            "This command will generate current realm information for the requested realm.",
            "The realm and region are optional, they will default to the following: ",
            "Realm: \x0303"+config.wow.homeRealm+"\x0302   Region: \x0303"+config.wow.homeRegion,
            "\x0315"+"Whisper this command to the bot for a private response!"],
        wowhead: [
            "\x0311"+"Syntax: !wowhead <Search>",
            "This command will generate a link to a wowhead search for the provided terms.",
            "\x0315"+"Whisper this command to the bot for a private response!"]
    },

    //Error report stating help command was not recognized
    Error: function(request) {
        return [
            "The command '!help <"+request+">' was not recognized as a supported help document.",
            "Please enter '!help list' to see supported documents"
        ]
    }
};

module.exports = Articles;