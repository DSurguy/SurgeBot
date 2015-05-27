var Clone = require('Clone.js'),
	Log = require('./Log.js');

module.exports = SurgeBot;
function SurgeBot(config){
	this.services = {};
	this.commands = {};
	this.passives = [];
	this.client = undefined;
	this.services['Log'] = new Log(config.log);
};

SurgeBot.prototype.listen = function(){
	this.services['Log'].log("\nBot started.", 1);

	//create a new IRC client
	bot.client = new irc.Client(
		config.irc.host, 
		config.irc.nick, 
		{
			channels: config.irc.channels,
			autoConnect: false
		}
	);

	//bind a listener for the messages
	bot.client.addListener('message', function (from, to, message, rawData) {
	    if( message[0] === "!" ){
	    	//determine which command has been sent
	    	var cmdEnd = message.indexOf(" ") !== -1 ? message.indexOf(" ") : message.length;
	    	var command = message.slice(1, cmdEnd);
	    	//check to see if we're handling the command
	    	if( bot.commands[command] ){
	    		//this is a command we can handle, parse it!
	    		this.commands[command].handler(from, to, message.slice(cmdEnd+1), rawData);
	    	}
	    }
	    else{
	    	//run through the passives
	    	for( var i=0; i<bot.messageHandlers.length; i++ ){
				if( message.search(bot.passives[i].trigger) !== -1 ){
					this.passives[i].handler(from, to, message);
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
	this.services['Log'].log("Attempting to connect to IRC on channels: "+config.irc.channels.join(","), 1);
	bot.client.connect(1, function(){
		this.services['Log'].log("Connection to IRC server successful. Listening for messages.", 1);
	});
};

SurgeBot.prototype.service = function(label, constructor){
	if( this.services[label] ){
		//name conflict
		throw new Error('Conflict on service name: '+label);
		return false;
	}
	if( typeof constructor == 'function' ){
		this.services[label] = new constructor();
	}
	else if( typeof constructor == 'object' ){
		this.services[label] = Clone(constructor);
	}
	else{
		throw new Error('Invalid constructor for service name: '+label);
	}
};

SurgeBot.prototype.command = function(trigger, constructor, config){
	//check for name conflict
	if( this.commands[trigger] ){
		throw new Error('Conflict on command: !'+trigger);
	}
	//make sure that all required services exist
	if( config.services ){
		for( var i=0; i<config.services.length; i++ ){
			if( this.services[config.services[i]] === undefined ){
				throw new Error('Service name \''+config.services[i]+'\' does not exists but is required by command: !'+trigger);
				return false;
			}
		}
	}

	//bind the command
	this.commands[trigger] = new constructor(this.client, this.services, config);
};

SurgeBot.prototype.passive = function(trigger, constructor, config){
	//check for name conflict
	if( this.commands[trigger] ){
		throw new Error('Conflict on command: !'+trigger);
	}
	//make sure that all required services exist
	if( config.services ){
		for( var i=0; i<config.services.length; i++ ){
			if( this.services[config.services[i]] === undefined ){
				throw new Error('Service name \''+config.services[i]+'\' does not exists but is required by command: !'+trigger);
				return false;
			}
		}
	}

	//bind the command
	this.commands[trigger] = new constructor(this.client, this.services, config);
};