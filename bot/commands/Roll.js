module.exports = Roll;
function Roll(client, services, config){
	this.client = client;
	this.services = services;
};

Roll.prototype.handler = function(from, to, params, raw){
	var Roll = this,
		argArray = params.split(" "),
		target = to;

	var args = {
		die: parseInt(argArray[0]? argArray[0] : ""),
		min: parseInt(argArray[0]? argArray[0] : ""),
		max: parseInt(argArray[1]? argArray[1] : ""),
		mult: (function (multArgs){
			for( var i=1; i<multArgs.length; i++ ){
				if( multArgs[i] == "-m" && multArgs[i+1] ){
					return parseInt(multArgs[i+1]);
				}
				else if( multArgs[i] == "-m" ){
					return NaN;
				}
			}
			return undefined;
		})(argArray)
	};

	switch(argArray.length){
		case 4:
			//assume !roll min max -m mult
			if( isNaN(args.min) || isNaN(args.max) || isNaN(args.mult) ){
				Roll.client.say(to, 'Malformed !roll. '
					+'Expected !roll <min> <max> -m <multiplier>, '
					+'got !roll <'+argArray[0]+'> <'+argArray[1]+'> <'+argArray[2]+'> <'+argArray[3]+'>. See \'!help roll\' for more information.');
			}
			else{
				Roll.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.max - args.min)) + args.min)*args.mult);
			}
		break;

		case 3:
			//assume !roll die -m mult
			if( isNaN(args.die) || isNaN(args.mult) ){
				Roll.client.say(to, 'Malformed !roll. '
					+'Expected !roll <die> -m <multiplier>, '
					+'got !roll <'+argArray[0]+'> <'+argArray[1]+'> <'+argArray[2]+'>. See \'!help roll\' for more information.');
			}
			else{
				Roll.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.die - 1)) + 1)*args.mult);
			}
		break;
	
		case 2:
			//assume !roll min max
			if( isNaN(args.min) || isNaN(args.max) ){
				Roll.client.say(to, 'Malformed !roll. '
					+'Expected !roll <min> <max>, '
					+'got !roll <'+argArray[0]+'> <'+argArray[1]+'>. See \'!help roll\' for more information.');
			}
			else{
				Roll.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.max - args.min)) + args.min) );
			}
		break;

		case 1:
			//assume !roll die
			if( isNaN(args.die) ){
				Roll.client.say(to, 'Malformed !roll. '
					+'Expected !roll <die>, '
					+'got !roll <'+argArray[0]+'>. See \'!help roll\' for more information.');
			}
			else{
				Roll.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.die - 1)) + 1) );
			}
		break;
		
		default:
			Roll.client.say(to, 'Malformed !roll. See \'!help roll\' for more information.');
		break;
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