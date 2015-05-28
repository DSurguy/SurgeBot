var SurgeBot = require("./SurgeBot.js"),
	Auth = require('./commands/Auth.js'),
	User = require('./services/User.js'),
	Roll = require('./commands/Roll.js'),
	YouTube = require('./passives/YouTube.js'),
	Config = require('./config.js');

process.on('uncaughtException', function (err) {
  	console.trace(err.stack);
  	process.exit(0);
});

var myBot = new SurgeBot({
	irc: Config.irc,
	log: Config.log
});

myBot.service('User', User, {
	email: Config.email,
	mongo: Config.mongo
});

myBot.passive('YouTube', YouTube, {
	googleApi: Config.googleApi
});

myBot.command('auth', Auth, {
	services: ['User'],
	irc: Config.irc
});
myBot.command('roll', Roll);

myBot.listen();