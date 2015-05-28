var SurgeBot = require("./SurgeBot.js"),
	Auth = require('./Auth.js'),
	User = require('./User.js'),
	//Roll = require('./Roll.js'),
	//YouTube = requre('./YouTube.js'),
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

//myBot.passive(/youtube\.com\/watch\?v=[A-Za-z0-9_\-]+(\s|$)/, YouTube, 'YouTube');

myBot.command('auth', Auth, {
	services: ['User'],
	irc: Config.irc
});
//myBot.command('roll', Roll);

myBot.listen();