var extend = require('extend'),
	Log = require('./services/Log.js'),
	Docs = require('./services/Docs.js'),
	Help = require('./commands/Help.js'),
	irc = require('irc'),
	Q = require('q');

module.exports = SurgeBot;
function SurgeBot(config){
	this.services = {};
	this.commands = {};
	this.passives = {};
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
	this.services['Docs'] = new Docs();
	this.services['IrcSession'] = {};
	this.command('help',Help);
};

SurgeBot.prototype.listen = function(){
	var bot = this;
	bot.services['Log'].log("Bot started.", 1);

	//bind a listener for the messages
	bot.client.addListener('message', function (from, to, message, rawData) {
		//check for a no-conflict mode command
	    if( bot.config.irc.noConflictMode && message.search(new RegExp('^\\!'+bot.services['IrcSession'].nick+'\\s+[a-zA-Z0-9]+','g') ) == 0){
	    	//remove the bot name, space and leading command ! from message
	    	message = message.slice( ('!'+bot.services['IrcSession'].nick).length+1 );
	    	//determine which command has been sent
	    	var cmdEnd = message.indexOf(" ") !== -1 ? message.indexOf(" ") : message.length;
	    	var command = message.slice(0, cmdEnd);
	    	//check to see if we're handling the command
	    	if( bot.commands[command] ){
	    		//this is a command we can handle, parse it!
	    		bot.services['Log'].log('Handling command in -noConflictMode: \''+command+'\' with params: '+message.slice(cmdEnd+1), 3);
	    		bot.commands[command].handler(from, to, message.slice(cmdEnd+1), rawData);
	    	}
	    }
	    //check to see if we were sent a message privately in noConflictMode
	    else if( bot.config.irc.noConflictMode
	    && to == bot.services['IrcSession'].nick
	    && message[0] == '!' ){
	    	//determine which command has been sent
	    	var cmdEnd = message.indexOf(" ") !== -1 ? message.indexOf(" ") : message.length;
	    	var command = message.slice(1, cmdEnd);
	    	//check to see if we're handling the command
	    	if( bot.commands[command] ){
	    		//this is a command we can handle, parse it!
	    		bot.services['Log'].log('Handling command in -noConflictMode -privateMsg: \''+command+'\' with params: '+message.slice(cmdEnd+1), 3);
	    		bot.commands[command].handler(from, to, message.slice(cmdEnd+1), rawData);
	    	}
	    }
	    //check for a regular command
	    else if( !bot.config.irc.noConflictMode && message[0] == '!' ){
	    	//determine which command has been sent
	    	var cmdEnd = message.indexOf(" ") !== -1 ? message.indexOf(" ") : message.length;
	    	var command = message.slice(1, cmdEnd);
	    	//check to see if we're handling the command
	    	if( bot.commands[command] ){
	    		//this is a command we can handle, parse it!
	    		bot.services['Log'].log('Handling command: \''+command+'\' with params: '+message.slice(cmdEnd+1), 3);
	    		bot.commands[command].handler(from, to, message.slice(cmdEnd+1), rawData);
	    	}
	    }
	    //now run passives if the message didn't come from the bot
	    else if( from !== bot.services['IrcSession'].nick ){
	    	bot.services['Log'].log('Testing passive triggers on message: '+message, 3);
	    	//run through the passives
	    	for( var label in bot.passives ){
				if( bot.passives.hasOwnProperty(label) && bot.passives[label].trigger(from, to, message, rawData) ){
					bot.services['Log'].log('Running passive handler: \''+label+'\' on message: '+message, 3);
					bot.passives[label].handler(from, to, message, rawData);
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
		bot.services['IrcSession'].nick = bot.client.nick;
		bot.services['Log'].log("Connection to IRC server successful. Listening for messages.", 1);
	});
};

SurgeBot.prototype.service = function(label, constructor, config){
	var bot = this;
	if( config === undefined ){ config = {}; }

	if( bot.services[label] ){
		//name conflict
		bot.services['Log'].error(new Error('Conflict on service name: '+label));
		return false;
	}
	if( typeof constructor == 'function' ){
		var serviceConfig = extend(true, {}, config, {
			irc: bot.config.irc
		});
		bot.services[label] = new constructor(bot.services, serviceConfig);
		bot.services['Log'].log('Successfully bound service: '+label, 2);
	}
	else if( typeof constructor == 'object' ){
		bot.services[label] = extend(true, {}, constructor);
		bot.services['Log'].log('Successfully bound service: '+label, 2);
	}
	else{
		bot.services['Log'].error(new Error('Invalid constructor for service name: '+label));
		return false;
	}

	//attempt to add a doc to help if available.
	//execute the command's doc function if available
	if( typeof bot.services[label].doc == "function" ){
		//add the doc if it returns an array of strings.
		var docResult = bot.services[label].doc();
		if( docResult.constructor.name == 'Array' ){
			var allStrings = true;
			for( var i=0; i<docResult.length; i++ ){
				if( typeof docResult[i] !== 'string' ){
					allStrings = false;
					break;
				}
			}
			if( allStrings ){
				//this doc is formatted correctly, add it!
				bot.services['Docs'].addServiceDoc(label, docResult);
			}
			else{
				bot.services['Log'].error(new Error('Service \''+label+'\' attempted to add a doc, but the doc array was not entirely strings.'));
			}
		}
		else{
			bot.services['Log'].error(new Error('Service \''+label+'\' attempted to add a doc, but did not return an array from the doc function.'));
		}
	}
	else if( bot.services[label].doc ){
		bot.services['Log'].error(new Error('Service \''+label+'\' attempted to add a doc, but did not provide a doc function.'));
	}
};

SurgeBot.prototype.command = function(trigger, constructor, config){
	var bot = this;
	if( config === undefined ){ config = {}; }

	//check for name conflict
	if( bot.commands[trigger] ){
		bot.services['Log'].error(new Error('Conflict on command: !'+trigger));
	}
	//make sure that all required services exist
	if( config.services ){
		for( var i=0; i<config.services.length; i++ ){
			if( bot.services[config.services[i]] === undefined ){
				bot.services['Log'].error(new Error('Service name \''+config.services[i]+'\' does not exists but is required by command: !'+trigger));
				return false;
			}
		}
	}

	//bind the command
	bot.commands[trigger] = new constructor(bot.client, bot.services, config);
	bot.services['Log'].log('Successfully bound command: '+trigger, 2);

	//attempt to add a doc to help if available.
	//execute the command's doc function if available
	if( typeof bot.commands[trigger].doc == "function" ){
		//add the doc if it returns an array of strings.
		var docResult = bot.commands[trigger].doc();
		if( docResult.constructor.name == 'Array' ){
			var allStrings = true;
			for( var i=0; i<docResult.length; i++ ){
				if( typeof docResult[i] !== 'string' ){
					allStrings = false;
					break;
				}
			}
			if( allStrings ){
				//this doc is formatted correctly, add it!
				bot.services['Docs'].addCommandDoc(trigger, docResult);
			}
			else{
				bot.services['Log'].error(new Error('Command \''+trigger+'\' attempted to add a doc, but the doc array was not entirely strings.'));
			}
		}
		else{
			bot.services['Log'].error(new Error('Command \''+trigger+'\' attempted to add a doc, but did not return an array from the doc function.'));
		}
	}
	else if( bot.commands[trigger].doc ){
		bot.services['Log'].error(new Error('Command \''+trigger+'\' attempted to add a doc, but did not provide a doc function.'));
	}
};

SurgeBot.prototype.passive = function(label, constructor, config){
	var bot = this;
	if( config === undefined ){ config = {}; }

	//check for name conflict
	if( bot.passives[label] ){
		bot.services['Log'].error(new Error('Conflict on passive handler: !'+trigger));
	}
	//make sure that all required services exist
	if( config.services ){
		for( var i=0; i<config.services.length; i++ ){
			if( bot.services[config.services[i]] === undefined ){
				bot.services['Log'].error(new Error('Service name \''+config.services[i]+'\' does not exists but is required by passive handler: !'+trigger));
				return false;
			}
		}
	}

	//bind the passive
	bot.passives[label] = new constructor(bot.client, bot.services, config);

	bot.services['Log'].log('Successfully bound passive handler: '+label, 2);

	//attempt to add a doc to help if available.
	//execute the command's doc function if available
	if( typeof bot.passives[label].doc == "function" ){
		//add the doc if it returns an array of strings.
		var docResult = bot.passives[label].doc();
		if( docResult.constructor.name == 'Array' ){
			var allStrings = true;
			for( var i=0; i<docResult.length; i++ ){
				if( typeof docResult[i] !== 'string' ){
					allStrings = false;
					break;
				}
			}
			if( allStrings ){
				//this doc is formatted correctly, add it!
				bot.services['Docs'].addPassiveDoc(label, docResult);
			}
			else{
				bot.services['Log'].error(new Error('Passive handler \''+label+'\' attempted to add a doc, but the doc array was not entirely strings.'));
			}
		}
		else{
			bot.services['Log'].error(new Error('Passive handler \''+label+'\' attempted to add a doc, but did not return an array from the doc function.'));
		}
	}
	else if( bot.passives[label].doc ){
		bot.services['Log'].error(new Error('Passive handler \''+label+'\' attempted to add a doc, but did not provide a doc function.'));
	}
};