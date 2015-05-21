var SurgeBot = require("./SurgeBot.js"),
	Auth = require('./Auth.js'),
	User = require('./User.js'),
	Roll = require('./Roll.js'),
	YouTube = requre('./YouTube.js');

process.on('uncaughtException', function (err) {
  	console.trace(err.stack);
  	process.exit(0);
});

var myBot = new SurgeBot();

myBot.service('User', User);

myBot.passive(/youtube\.com\/watch\?v=[A-Za-z0-9_\-]+(\s|$)/, YouTube, 'YouTube');

myBot.command('auth', Auth, ['User']);
myBot.command('roll', Roll);

myBot.listen();