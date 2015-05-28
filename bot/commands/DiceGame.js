module.exports = DiceGame;
function DiceGame(client, services, config){
	this.state: 0,
	this.players: [],
	this.bid: 0,
	this.host: undefined
};

DiceGame.prototype.handler = function(from, to, params){
	var bot = this,
		argArray = params.split(" "),
		argString = params,
		target = to;

	if( to == from ){
		bot.client.say(to, '\x0304Dice Game must be started from main channel.');
	}

	var args = {
		bid: (function (bidArgs){
			for( var i=1; i<bidArgs.length; i++ ){
				if( bidArgs[i] == "-b" && bidArgs[i+1] ){
					return parseInt(bidArgs[i+1]);
				}
				else if( bidArgs[i] == "-b" ){
					return NaN;
				}
			}
			return undefined;
		})(argArray),
		start: argString.search(/\bstart\b/g) == 0,
		end: argString.search(/\bend\b/g) == 0,
		play: argString.search(/\bplay\b/g) == 0,
	};

	switch( argArray.length ){
		case 3:
			//expect !diceGame start -b bid
			if( !args.start || isNaN(args.bid) ){
				//malformed
			}
			else if( bot._diceGame.state == 1 && args.start ){
				//game already started
			}
			//check if this player has enough currency and then start the game
			else{
				if( bot.checkCurrency(from, args.bid) ){
					//good to start the game
					bot._diceGame.state = 1;
					bot._diceGame.bid = args.bid;
					bot._diceGame.host = from;
					//auto-join this player
					var playerRoll = (Math.floor(Math.random() * (args.bid-1))+1);
					bot._diceGame.players.push({player: from, roll: playerRoll});
					//report the game start
					bot.client.say(to, '\x0303Dice Game Started! \x0301BID: \x0310'+args.bid+' \x0301Type \'!diceGame play\' to join in!');
					bot.client.say(to, from+' joined the game and rolled \x0303 '+playerRoll+' \x0314(out of '+args.bid+')');
				}
				else{
					//not enough cash
					bot.client.say(to, from+' doesn\'t have enough '+bot._currency.name+' to join the game!');
				}
			}
		break;
		case 1:
			//expect !diceGame end or !diceGame play
			if( !args.end && !args.play ){
				//malformed
				bot.client.say(to, 'malformed request, tard');
			}
			else if( (args.end || args.play) && bot._diceGame.state == 0 ){
				//game not started
				bot.client.say(to, 'game no start');
			}
			else if( args.end && bot._diceGame.host !== from ){
				//not correct host
				bot.client.say(to, "INCORRECTO HOSTO");
			}
			else if( args.end ){
				//correct host, end the game and payout
				var results = bot._diceGame.players.reduce(function (resultObj, player){
					if( player.roll > resultObj.winnerRoll ){
						resultObj.winner = player.player;
						resultObj.winnerRoll = player.roll;
					}
					if( player.roll < resultObj.loserRoll ){
						resultObj.loser = player.player;
						resultObj.loserRoll = player.roll;
					}
					return resultObj;
				}, {
					winner: undefined,
					winnerRoll: 0,
					loser: undefined,
					loserRoll: bot._diceGame.bid
				});

				//report winner and loser
				bot.client.say(to, '\x0303WINNER: '+results.winner+'\x0310('+results.winnerRoll+') \x0301:: \x0304LOSER: '+results.loser+'\x037('+results.loserRoll+')');
				bot.client.say(to, '\x0314'+results.loser+' sends '+(results.winnerRoll-results.loserRoll)+' '+bot._currency.name+' to '+results.winner+'.');
			}
			else if( args.play ){
				//search the players list for this user
				var userFound = bot._diceGame.players.reduce(function (found, player){
					if( found || player.name == from ){
						return true;
					}
					return false;
				},false);
				if( userFound ){
					//user already rolled
					bot.client.say(from, 'You have already joined the game in progress with a roll of '+bot._diceGame.players.reduce(function (roll, player){
						if( player.player == from ){
							roll = player.roll;
						}
						return roll;
					}, undefined)+'. Good luck!');
				}
				else{
					//add a new player with a roll for this user and report
					var playerRoll = (Math.floor(Math.random() * (bot._diceGame.bid-1))+1);
					bot._diceGame.players.push({
						player: from,
						roll: playerRoll
					});
					bot.client.say(to, from+' joined the game and rolled \x0303 '+playerRoll+' \x0314(out of '+bot._diceGame.bid+')');
				}
			}
		break;
		default:
			//malformed
			bot.client.say(to, 'malformed request, tard');
		break;
	}
};