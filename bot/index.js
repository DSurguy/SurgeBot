var SurgeBot = require("./SurgeBot.js"),
	Auth = require('./commands/Auth.js'),
	User = require('./services/User.js'),
	Roll = require('./commands/Roll.js'),
	YouTube = require('./passives/YouTube.js'),
	MiddleTest = require('./middleware/MiddleTest.js'),
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

/*myBot.middleware('MiddleTest', MiddleTest);
myBot.middleware('MiddleTest2', MiddleTest);*/

myBot.passive('YouTube', YouTube, {
	googleApi: Config.googleApi
});

myBot.command('auth', Auth, {
	services: ['User'],
	irc: Config.irc
});
myBot.command('roll', Roll, {
	dieNumLimit: 100,
	dieSizeLimit: 100
});

myBot.listen();