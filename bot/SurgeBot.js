var Clone = require('./Clone.js'),
	Log = require('./Log.js'),
	irc = require('irc'),
	Q = require('q');

module.exports = SurgeBot;
function SurgeBot(config){
	this.services = {};
	this.commands = {};
	this.passives = [];
	this.config = config;
	this.client = new irc.Client(
		this.config.irc.host, 
		this.config.irc.nick, 
		{
			channels: this.config.irc.channels,
			autoConnect: false
		}
	);
	this.services['Log'] = new Log(config.log);
};

SurgeBot.prototype.listen = function(){
	var bot = this;
	bot.services['Log'].log("\nBot started.", 1);

	//bind a listener for the messages
	bot.client.addListener('message', function (from, to, message, rawData) {
	    if( message[0] === "!" ){
	    	//determine which command has been sent
	    	var cmdEnd = message.indexOf(" ") !== -1 ? message.indexOf(" ") : message.length;
	    	var command = message.slice(1, cmdEnd);
	    	//check to see if we're handling the command
	    	if( bot.commands[command] ){
	    		//this is a command we can handle, parse it!
	    		bot.commands[command].handler(from, to, message.slice(cmdEnd+1), rawData);
	    	}
	    }
	    else{
	    	//run through the passives
	    	for( var i=0; i<bot.messageHandlers.length; i++ ){
				if( message.search(bot.passives[i].trigger) !== -1 ){
					bot.passives[i].handler(from, to, message);
					if( bot.config.irc.breakOnPassive ){
						break;
					}
				}
			}
	    }
	});

	bot.client.addListener('error', function (message) {
	    bot.services['Log'].error('IRC Error: '+message);
	});

	//attempt to connect to the IRC server
	bot.services['Log'].log("Attempting to connect to IRC on channels: "+bot.config.irc.channels.join(","), 1);
	bot.client.connect(1, function(){
		bot.services['Log'].log("Connection to IRC server successful. Listening for messages.", 1);
	});
};

SurgeBot.prototype.service = function(label, constructor, config){
	var bot = this;
	if( bot.services[label] ){
		//name conflict
		throw new Error('Conflict on service name: '+label);
		return false;
	}
	if( typeof constructor == 'function' ){
		var serviceConfig = Clone(config);
		serviceConfig.irc = bot.config.irc;
		bot.services[label] = new constructor(bot.services, serviceConfig);
	}
	else if( typeof constructor == 'object' ){
		bot.services[label] = Clone(constructor);
		bot.services['Log'].log('Successfully bound service: '+label);
	}
	else{
		throw new Error('Invalid constructor for service name: '+label);
	}
};

SurgeBot.prototype.command = function(trigger, constructor, config){
	var bot = this;
	//check for name conflict
	if( bot.commands[trigger] ){
		throw new Error('Conflict on command: !'+trigger);
	}
	//make sure that all required services exist
	if( config.services ){
		for( var i=0; i<config.services.length; i++ ){
			if( bot.services[config.services[i]] === undefined ){
				throw new Error('Service name \''+config.services[i]+'\' does not exists but is required by command: !'+trigger);
				return false;
			}
		}
	}

	//bind the command
	bot.commands[trigger] = new constructor(bot.client, bot.services, config);
};

SurgeBot.prototype.passive = function(trigger, constructor, config){
	var bot = this;
	//check for name conflict
	if( bot.commands[trigger] ){
		throw new Error('Conflict on command: !'+trigger);
	}
	//make sure that all required services exist
	if( config.services ){
		for( var i=0; i<config.services.length; i++ ){
			if( bot.services[config.services[i]] === undefined ){
				throw new Error('Service name \''+config.services[i]+'\' does not exists but is required by command: !'+trigger);
				return false;
			}
		}
	}

	//bind the command
	bot.commands[trigger] = new constructor(bot.client, bot.services, config);
};