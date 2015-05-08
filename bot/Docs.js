var config = require('./config.js');

var Articles = {
    //This contains a map of commands supported by help, and their associated help document
    Manifest: [
        {cmd: "roll,!roll", docMap: "Commands.roll"}
    ],

    List: [
        "\x0311"+"Available Help Docs:",
        "roll"
    ],

    //WoWIRCBot command documentation
    Commands: {
        roll: [
            "\x0311"+"Syntax: !roll <die/minRoll> [<maxRoll>] [-m <multiplier>]",
            "This command will execute a simulated dice roll, returning a random integer in the bounds provided.",
            "The only required paramter is the die value. !roll # will roll between 1 and that number.",
            "Passing a minimum and maximum (!roll min# max#) will roll between the given numbers. As an example, !roll 10 20 will roll between 10 and 20.",
            "Passing the -m flag followed by a number will cause the result of the die or min/max roll to be multiplied by the given value. As an example, !roll 1 -m 3 will roll 3.",
            "\x0315"+"Whisper this command to the bot for a private response!" ]
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