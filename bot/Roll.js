//!roll 
var roll = function(bot, from, to, params){
	var argArray = params.split(" "),
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
				bot.client.say(to, 'Malformed !roll. '
					+'Expected !roll <min> <max> -m <multiplier>, '
					+'got !roll <'+argArray[0]+'> <'+argArray[1]+'> <'+argArray[2]+'> <'+argArray[3]+'>. See \'!help roll\' for more information.');
			}
			else{
				bot.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.max - args.min)) + args.min)*args.mult);
			}
		break;

		case 3:
			//assume !roll die -m mult
			if( isNaN(args.die) || isNaN(args.mult) ){
				bot.client.say(to, 'Malformed !roll. '
					+'Expected !roll <die> -m <multiplier>, '
					+'got !roll <'+argArray[0]+'> <'+argArray[1]+'> <'+argArray[2]+'>. See \'!help roll\' for more information.');
			}
			else{
				bot.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.die - 1)) + 1)*args.mult);
			}
		break;
	
		case 2:
			//assume !roll min max
			if( isNaN(args.min) || isNaN(args.max) ){
				bot.client.say(to, 'Malformed !roll. '
					+'Expected !roll <min> <max>, '
					+'got !roll <'+argArray[0]+'> <'+argArray[1]+'>. See \'!help roll\' for more information.');
			}
			else{
				bot.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.max - args.min)) + args.min) );
			}
		break;

		case 1:
			//assume !roll die
			if( isNaN(args.die) ){
				bot.client.say(to, 'Malformed !roll. '
					+'Expected !roll <die>, '
					+'got !roll <'+argArray[0]+'>. See \'!help roll\' for more information.');
			}
			else{
				bot.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.die - 1)) + 1) );
			}
		break;
		
		default:
			bot.client.say(to, 'Malformed !roll. See \'!help roll\' for more information.');
		break;
	}
};

module.exports = {
	roll:roll
}