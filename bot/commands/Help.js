module.exports = Help;

function Help(client, services, config){
	this.client = client;
	this.services = services;
};

// !help [-l]|[-c <command>]|[-s <service>]|[-p <passiveHandler>]
Help.prototype.handler = function(from, to, params, raw){
	var Help = this,
		argArray = params.split(/\s+/g),
		target = to,
		args = {};

	args.cmdFlag = argArray.indexOf('-c') == 0 ? argArray[argArray.indexOf('-c')] : undefined;
	args.cmd = argArray.indexOf('-c') == 0 ? argArray[argArray.indexOf('-c')+1] : undefined;

	args.pasvFlag = argArray.indexOf('-p') == 0 ? argArray[argArray.indexOf('-p')] : undefined;
	args.pasv = argArray.indexOf('-p') == 0 ? argArray[argArray.indexOf('-p')+1] : undefined;

	args.servFlag = argArray.indexOf('-s') == 0 ? argArray[argArray.indexOf('-s')] : undefined;
	args.serv = argArray.indexOf('-s') == 0 ? argArray[argArray.indexOf('-s')+1] : undefined;

	args.listFlag = argArray.indexOf('-l') == 0 ? argArray[argArray.indexOf('-l')] : undefined;

	args.helpFlag = argArray[0] == "" && argArray.length == 1;

	if( args.cmd ){
		//attempt to display the help for this command
		var cmdDoc = Help.services['Docs'].getCommandDoc(args.cmd);
		if( cmdDoc ){
			//we got a doc, spit it out to the requester
			for( var i=0; i<cmdDoc.length; i++ ){
		        Help.client.say(from, cmdDoc[i]);
		    }
		}
		else{
			Help.client.say(from, 'Unable to find help doc for command: '+args.cmd+'. Try \'!help -l\' to see a list of available command docs.');
		}
	}
	else if( args.pasv ){
		//attempt to display the help for this command
		var pasvDoc = Help.services['Docs'].getPassiveDoc(args.pasv);
		if( pasvDoc ){
			//we got a doc, spit it out to the requester
			for( var i=0; i<pasvDoc.length; i++ ){
		        Help.client.say(from, pasvDoc[i]);
		    }
		}
		else{
			Help.client.say(from, 'Unable to find help doc for passive handler: '+args.cmd+'. Try \'!help -l\' to see a list of available passive handler docs.');
		}
	}
	else if( args.serv ){
		//attempt to display the help for this command
		var servDoc = Help.services['Docs'].getPassiveDoc(args.serv);
		if( servDoc ){
			//we got a doc, spit it out to the requester
			for( var i=0; i<servDoc.length; i++ ){
		        Help.client.say(from, servDoc[i]);
		    }
		}
		else{
			Help.client.say(from, 'Unable to find help doc for service: '+args.serv+'. Try \'!help -l\' to see a list of available service docs.');
		}
	}
	else if( args.listFlag ){
		//display the available help docs, one section at a time
		var listDoc = Help.services['Docs'].getList();
		Help.client.say(from, 'Command docs: '+listDoc.commands.join(","));
		Help.client.say(from, 'Passive handler docs: '+listDoc.passives.join(","));
		Help.client.say(from, 'Service docs: '+listDoc.services.join(","));
	}
	else if( args.helpFlag ){
		//the user just typed 'help', so tell them how to use help
		Help.client.say(from, 'The \'!help\' command provides access to docs for commands, services and passive message handlers bound to '+Help.services['IrcSession'].nick);
		Help.client.say(from, 'Use \'!help -l\' to see a list of available help docs.');
		Help.client.say(from, 'Use \'!help -c <command>\' to see a help doc for a command.');
		Help.client.say(from, 'Use \'!help -p <passiveHandler>\' to see a help doc for a passive message handler.');
		Help.client.say(from, 'Use \'!help -s <service>\' to see a help doc for a bot service.');
	}
	else{
		//malformed request
		Help.client.say(from, '\x0304Malformed Command.\x0301 Expected \'!help [-l]|[-c <command>]|[-s <service>]|[-p <passiveHandler>]\'.'
			+'Type \'!help\' with no arguments to learn how to use this command.');
	}
};