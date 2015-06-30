var extend = require('extend');

module.exports = Roll;
function Roll(client, services, config){
	this.client = client;
	this.services = services;
	this.config = extend(true, {
		dieNumLimit: 100,
		dieSizeLimit: 100
	},config);

	this._const = {
		e: {
			dieLimit: 0,
			badDie: 1
		}
	};
};

Roll.prototype.handler = function(from, to, params, raw){
	var Roll = this,
		argArray = params.split(" "),
		target = to;

	var args = {
		die: (/^\d+(?:d\d+)?$/g).test(argArray[0]) ? argArray[0] : undefined,
		min: (/^\d+(?:d\d+)?$/g).test(argArray[0]) ? argArray[0] : undefined,
		max: (/^\d+(?:d\d+)?$/g).test(argArray[1]) ? argArray[1] : undefined,
		mult: (function (multArgs){
			for( var i=1; i<multArgs.length; i++ ){
				if( multArgs[i] == "-m" && (/^\d+(?:d\d+)?$/g).test(multArgs[i+1]) ){
					return multArgs[i+1];
				}
			}
			return undefined;
		})(argArray),
		plus: (function (multArgs){
			var isPlus = /^\+\d+(?:d\d+)?$/g
			for( var i=1; i<multArgs.length; i++ ){
				if( isPlus.test(multArgs[i]) ){
					return multArgs[i].slice(1);
				}
			}
			return undefined;
		})(argArray),
		minus: (function (multArgs){
			var isMinus = /^\-\d+(?:d\d+)?$/g
			for( var i=1; i<multArgs.length; i++ ){
				if( isMinus.test(multArgs[i]) ){
					return multArgs[i].slice(1);
				}
			}
			return undefined;
		})(argArray)
	};

	var dieRoll = 0;

	//make sure to catch unparsed dies
	try{
		if( args.min && args.max ){
			dieRoll = this._parseDiceRoll(args.min, args.max)
		}
		else if( args.die ){
			dieRoll = this._parseDiceRoll(args.die);
		}
		else{
			//malformed roll
			Roll.client.say(to, 'Malformed !roll. '
				+'Expected !roll <die|min> <max>, '
				+'got !roll <'+argArray[0]+'> <'+argArray[1]+'>. See \'!help roll\' for more information.');
			return;
		}
	} catch (e){
		if( e.code == this._const.e.dieLimit ){
			Roll.client.say(to, 'Malformed !roll. '
				+'Die of '+e.die+' exceeds die limit of '+this.config.dieNumLimit+'d'+this.config.dieSizeLimit+'.');
		}
		else if( e.code == this._const.e.badDie ){
			Roll.client.say(to, 'Malformed !roll. '
				+'Die of '+e.die+' could not be parsed.');
		}
	}

	//apply modifiers
	if( args.mult ){
		if( (/^\d+d\d+$/g).test(args.mult) ){
			dieRoll *= this._parseDiceRoll(args.mult);	
		}
		else{
			dieRoll *= parseInt(args.mult);
		}
	}

	if( args.plus ){
		if( (/^\d+d\d+$/g).test(args.plus) ){
			dieRoll += this._parseDiceRoll(args.plus);	
		}
		else{
			dieRoll += parseInt(args.plus);
		}
	}

	if( args.minus ){
		if( (/^\d+d\d+$/g).test(args.minus) ){
			dieRoll -= this._parseDiceRoll(args.minus);	
		}
		else{
			dieRoll -= parseInt(args.minus);
		}
	}

	//report the results
	Roll.client.say(to, from+" rolls a\x0306 "+dieRoll );
};

Roll.prototype._parseDiceRoll = function(die, die2){
	//determine if this is a multi-die roll
	var dieVal1 = 0,
		dieVal2 = 0;
	if( (/^\d+d\d+$/g).test(die) ){
		//multi-die!
		var dieSplit = die.split('d');
		//check to see if the passed die exceeds the limits in config
		if( parseInt(dieSplit[0]) > this.config.dieNumLimit || parseInt(dieSplit[0]) > this.config.dieSizeLimit ){
			throw new Error({
				code: this._const.e.dieLimit,
				die: die
			});
		}
		if( parseInt(dieSplit[0]) == 1 ){
			dieVal1 = parseInt(dieSplit[1]);
		}
		else{
			for( var i=0; i<parseInt(dieSplit[0]); i++ ){
				dieVal1 += Math.floor(Math.random() * (parseInt(dieSplit[1]))) + 1;
			}
		}
	}
	else if( (/^\d+$/g).test(die) ){
		dieVal1 = parseInt(die);
	}
	else{
		//malformed die somehow
		throw new Error({
			code: this._const.e.badDie,
			die: die
		});
	}

	if( die2 && (/^\d+d\d+$/g).test(die2) ){
		//multi-die!
		var dieSplit = die2.split('d');
		//check to see if the passed die exceeds the limits in config
		if( parseInt(dieSplit[0]) > this.config.dieNumLimit || parseInt(dieSplit[0]) > this.config.dieSizeLimit ){
			throw new Error({
				code: this._const.e.dieLimit,
				die: die2
			});
		}
		if( parseInt(dieSplit[0]) == 1 ){
			dieVal2 = parseInt(dieSplit[1]);
		}
		else{
			for( var i=0; i<parseInt(dieSplit[0]); i++ ){
				dieVal2 += Math.floor(Math.random() * (parseInt(dieSplit[1]))) + 1;
			}
		}
	}
	else if( die2 &&(/^\d+$/g).test(die2) ){
		dieVal2 = parseInt(die2);
	}
	else if( die2 ) {
		//malformed die somehow
		throw new Error({
			code: this._const.e.badDie,
			die: die2
		});
	}

	console.log(dieVal1, dieVal2, arguments);

	if( dieVal2 ){
		return Math.floor( Math.random() * (dieVal2 - dieVal1 + 1)) + dieVal1;
	}
	else {
		return Math.floor( Math.random() * (dieVal1)) + 1;
	}
};

Roll.prototype.doc = function(){
	return ["\x0311"+"Syntax: !roll <die/minRoll> [<maxRoll>] [-m <multiplier>]",
        "This command will execute a simulated dice roll, returning a random integer in the bounds provided.",
        "The only required paramter is the die value. !roll # will roll between 1 and that number.",
        "Passing a minimum and maximum (!roll min# max#) will roll between the given numbers. As an example, !roll 10 20 will roll between 10 and 20.",
        "Passing the -m flag followed by a number will cause the result of the die or min/max roll to be multiplied by the given value. As an example, !roll 1 -m 3 will roll 3.",
        "\x0315"+"Whisper this command to the bot for a private response!" ];
};