var config = require('./config.js');

var Articles = {
    //This contains a map of commands supported by help, and their associated help document
    Manifest: [
        {cmd: "roll", docMap: "Commands.roll"},
        {cmd: "auth", docMap: "Commands.auth"},
        {cmd: ["list",undefined], docMap: "List"},
    ],

    List: [
        "\x0311"+"Available Help Docs:",
        "roll",
        "auth"
    ],

    //WoWIRCBot command documentation
    Commands: {
        roll: [
            "\x0311"+"Syntax: !roll <die/minRoll> [<maxRoll>] [-m <multiplier>]",
            "This command will execute a simulated dice roll, returning a random integer in the bounds provided.",
            "The only required paramter is the die value. !roll # will roll between 1 and that number.",
            "Passing a minimum and maximum (!roll min# max#) will roll between the given numbers. As an example, !roll 10 20 will roll between 10 and 20.",
            "Passing the -m flag followed by a number will cause the result of the die or min/max roll to be multiplied by the given value. As an example, !roll 1 -m 3 will roll 3.",
            "\x0315"+"Whisper this command to the bot for a private response!" ],
        auth: [
            "\x0311"+"Syntax: !auth [<user> <pass>]|[-r <email> <user>]|[-c <code> <user> <pass>]|[-p user]",
            "This command can be used to register a username, with an associated email and password. Some secure ! commands require a user to be registered.",
            "The base command of !auth <user> <pass> will attempt to login the user, provided they are registered.",
            "The -r flag starts the registration process for a new user",
            "The -c flag accepts a confirmation code sent in an email as part of the registration process or to reset a password.",
            "The -p flag tells the bot to send a password reset code to the user's associated email.",
            "\x0307NEVER PASTE YOUR PASSWORD IN A PUBLIC CHANNEL. \x0301Send !auth commands to the bot directly with /msg "+config.irc.nick+" !auth"
        ]
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