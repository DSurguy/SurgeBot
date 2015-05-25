'use strict';

var db = require('./Database');
var Q = require('q');
var bcrypt = require('bcrypt-nodejs');

//!auth [-r <email> <user>]|[-c <code> <user> <pass>]|[<user> <pass>]|[-p user]
var auth = function (bot, from, to, params, raw){
	var argArray = params.split(/\s+/g),
		target = to,
		args;

	args = {
		pass: argArray.length == 2 ? argArray[1] : undefined,
		user: argArray.length == 2 ? argArray[0] : undefined
	};

	bot.log(JSON.stringify(args), 4)

	args.regFlag = argArray.indexOf('-r') == 0 ? argArray[argArray.indexOf('-r')] : undefined;
	args.regEmail = argArray.indexOf('-r') == 0 ? argArray[argArray.indexOf('-r')+1] : undefined;
	args.regUser = argArray.indexOf('-r') == 0 ? argArray[argArray.indexOf('-r')+2] : undefined;

	args.codeFlag = argArray.indexOf('-c') == 0 ? argArray[argArray.indexOf('-c')] : undefined;
	args.code = argArray.indexOf('-c') == 0 ? argArray[argArray.indexOf('-c')+1] : undefined;
	args.codeUser = argArray.indexOf('-c') == 0 ? argArray[argArray.indexOf('-c')+2] : undefined;
	args.codePass = argArray.indexOf('-c') == 0 ? argArray[argArray.indexOf('-c')+3] : undefined;

	args.resetFlag = argArray.indexOf('-p') == 0 ? argArray[argArray.indexOf('-p')] : undefined;
	args.resetUser = argArray.indexOf('-p') == 0 ? argArray[argArray.indexOf('-p')+1] : undefined;

	//Registration
	if( args.regEmail && args.regUser ){
		handleRegistration(bot, args.regEmail, args.regUser, from).then(function (){
			//user is registered
			bot.client.say(from, 'Registration request received. Please check the email you registered with for an auth code.'
				+' You can use the code with !auth -c <CODE> <USER> <PASS> to complete the registration process.');
		}, function (err){
			bot.client.say(from, '\x0304-e- Error during registration: '+err+'. Please contact bot administrator for details.');
		});
	}
	else if( args.regFlag ){
		bot.client.say(from, 'Malformed !auth. Expected !auth -r <email> <user>, but got '
			+'!auth -r <'+args.regEmail+'> <'+args.regUser+'>. Please enter a valid email and username to register.');
	}
	//Auth Code
	else if( args.code && args.codeUser && args.codePass ){
		if( pendingRegistrations[args.codeUser] ){
			//check if the code pasted matches
			if( pendingRegistrations[args.codeUser].code == args.code ){
				//this user is now registered, add them to the database and prompt for auth
				var newUser = pendingRegistrations[args.codeUser];
				addUser(args.codeUser, args.codePass, newUser.email).then(function(){
					//now prompt for auth since the user exists
					bot.client.say(from, 'You are now registered to '+config.irc.nick+' as '+args.codeUser+'! Please auth with !auth <user> <pass> to complete login.');
				}).catch(function (err){
					//tell the user there was an error.
					console.log(err);
					bot.client.say(from, '\x0304There was an error during registration. \x0301Please see the bot administrator for details.');
				});
			}
			else if( pendingRegistrations[args.codeUser].attempts == 2 ){
				//Too many invalid attempts. Remove the pending auth.
				bot.log('User '+args.codeUser+' has failed too many auth code attempts.', 2);
				delete pendingRegistrations[args.codeUser];
				bot.client.say('\x0304Too many invalid registration attempts have been detected. Your registration attempt has been removed and logged. Please see bot administrator for details.')
			}
			else{
				//log a failed attempt
				pendingRegistrations[args.codeUser].attempts++;
				bot.client.say(from, '\x0304Invalid auth code. Please try again. You have '+(3-pendingRegistrations[args.codeUser].attempts)+' attempts remaining before the code is invalidated.');
			}
		}
		else if( pendingResets[args.codeUser] ){
			if( pendingResets[args.codeUser].code == args.code ){
				updatePassword(args.codeUser, args.codePass).then(function(){
					bot.client.say(from, 'Your password has been updated. Please auth with !auth <user> <pass> to complete login.');
				}, function (err){
					bot.client.say(from, '\x0304There was an error during the password reset process. \x0301Please see the bot administrator for details.');
				});
			}
			else if( pendingResets[args.codeUser].attempts == 2 ){
				//Too many invalid attempts. Remove the pending auth.
				bot.log('User '+args.codeUser+' has failed too many auth code attempts.', 2);
				delete pendingResets[args.codeUser];
				bot.client.say('\x0304Too many invalid password resets attempts have been detected. Your reset attempt has been removed and logged. Please see bot administrator for details.')
			}
			else{
				//log a failed attempt
				pendingResets[args.codeUser].attempts++;
				bot.client.say(from, '\x0304Invalid auth code code. Please try again. You have '+(3-pendingResets[args.codeUser].attempts)+' attempts remaining before the code is invalidated.');
			}
		}
	}
	else if( args.codeFlag ){
		bot.client.say(from, 'Malformed !auth. Expected !auth -c <code> <user> <newPassword>, but got '
			+'!auth -c <'+args.code+'> <'+args.codeUser+'> <'+args.codePass+'>. Please enter a valid email and username to register.');
	}
	//Password Reset
	else if( args.resetUser ){
		handleReset(bot, args.resetUser, from, raw).then(function(){
			bot.client.say(from, 'Password reset request received. Please check the email you registered with for an auth code.'
				+' You can use the code with !auth -c <CODE> <USER> <PASS> to complete the password reset process.');
		}, function (err){
			bot.client.say(from, '\x0304There was an error during the password reset process. \x0301Please see the bot administrator for details.');
		});
	}
	else if( args.resetFlag ){
		bot.client.say(from, 'Malformed !auth. Expected !auth -p <user>, but got '
			+'!auth -p <'+args.resetUser+'>. See !help auth for more information.');
	}
	//Login
	else if( args.user && args.pass ){
		handleLogin(bot, args.user, args.pass, from, raw).then(function(){
			bot.client.say(from, '\x0303You are now logged in as '+args.user+'. Welcome back!');
		}, function (err){
			console.log(err);
			bot.client.say(from, '\x0304Error during login: '+err+'. Please see bot administrator for details.');
		});
	}
	else {
		//malformed request. Prompt help
		bot.client.say(from, 'Malformed !auth. Expected !auth [-r <email> <user>]|[-c <code> <user> <pass>]|[<user> <pass>]|[-p user]. See \x0314!help auth \x0301for details.');
	}
};
var authedUsers = {};
var pendingRegistrations = {};
var pendingResets = {};
var generateAuthCode = function(){
	var chars = [0,1,2,3,4,5,6,7,8,9],
		authCode = [];

	for( var i=0; i<26; i++ ){
		chars.push(String.fromCharCode(65+i));
		chars.push(String.fromCharCode(97+i));
	}

	//generate 8 random characters and return them
	for( var i=0; i<8; i++ ){
		authCode.push( chars[Math.floor(Math.random()*(chars.length-1))] );
	}
	return authCode.join("");
};
var addUser = function(name, pwd, email){
	var user = {
		name: name,
		pwd: bcrypt.hashSync(pwd),
		email: email,
		currency: 1000
	};

	return db.insert('Users', user);
};
var updatePassword = function(name, pwd){
	var deferred = Q.defer();

	var doc = { 
		$set: { 
			pwd: bcrypt.hashSync(pwd)  
		}
	};
	db.update('Users', {name: name}, doc).then(function(result) {
		delete pendingResets[name];
		deferred.resolve(result);		
	}).catch(function(err) {
		deferred.reject(err);
	});
	
	return deferred.promise;
};

var handleRegistration = function(bot, regEmail, regUser, from){
	var d$registration = Q.defer();


	var filter = { $or: [{name: regUser}, {email: regEmail}] };
	db.find('Users', filter).then(function(docs) {
		if( docs.length > 0 ){
			//this user exists, resolve the deferred object with the user data
			d$registration.reject('User or email already registered.');
		}
		else{
			//this user doesn't exists, start the registration process
			//check if this is a real email
			if( (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$/).test(regEmail) ){
				//generate an auth code for this user
				var authCode = generateAuthCode();

				//send the email
				var emailMsg = ['SurgeBot has received a registration request for the user '+regUser+' from the nick '+from+' on network: '+config.irc.host,
					'Paste the following command in IRC to whisper your registration code to '+config.irc.nick+'. Replace PASS with a new password.',
					'',
					'/msg '+config.irc.nick+' !auth -c '+authCode+' '+regUser+' PASS',
					'',
					'If you experience problems, please contact your channel\'s bot administrator. Replies to this email will be ignored.']
				bot.mailTransport.sendMail({
					from: config.irc.nick+' The IRC Bot <'+config.email.replyTo+'>',
					to: regEmail,
					subject: config.irc.nick+' IRC Registration Confirmation',
					text: emailMsg.join("\n"),
					html: '<p>'+emailMsg.join("</p><p>")+'</p>'
				}, function (err){
					if( err ){
						//log and report
						bot.log('MailError: '+err, 2);
						d$registration.reject('Unable to send email to '+regEmail);
					} 
					else{
						//report success and wait for auth code
						pendingRegistrations[regUser] = {
							code: authCode,
							email: regEmail,
							attempts: 0
						};
						d$registration.resolve();
					}
				});
			}
			else{
				//please enter a real email or password
				d$registration.reject('Please enter a valid email to register.');
			}
		}
	}).catch(function(err) {
		bot.log('Error during user registration: '+err);
		d$registration.reject('Error during user lookup, please contact bot administrator for details');
	});

	return d$registration.promise;
};

var handleLogin = function(bot, loginUser, loginPass, from, raw){
	var deferred = Q.defer();

	db.find('Users', {name: loginUser}).then(function(docs) {
		
		if( docs == undefined ){
			//user does not exist
			deferred.reject('Username or password is incorrect. If you need a password reset, use !auth -p.');
		} else {
			if( authedUsers[loginUser] ){
				deferred.reject('User is already logged in.');
			}
			if( bcrypt.compareSync(loginPass, docs[0].pwd) ){
				//successful new login
				authedUsers[loginUser] = {
					session: raw.user+'@'+raw.host,
					currency: docs[0].currency
				};

				deferred.resolve();
			} else {
				//pass didn't match somehow
				deferreds.reject('Username or password is incorrect. If you need a password reset, use !auth -p.')
			}
		}
	}).catch(function(err) {
		if( err ){
			bot.log('Error during user registration: '+err);
			deferred.reject('Error during user lookup, please contact bot administrator for details');
			return;
		}
	});
	return deferred.promise;
};

var handleReset = function(bot, resetUser, from, raw){
	var d$reset = Q.defer();

	db.find('Users', { name: resetUser}).then(function() {
		if( docs.length == 0 ){
			//this user doesn't exist, do nothing, but resolve to obscure user existance
			d$reset.resolve();
		}
		else{
			//this user exists, send an auth code and add them to pending resets
			var authCode = generateAuthCode();

			//send the email
			var emailMsg = ['SurgeBot has received a password reset request for the user '+resetUser+' from the nick '+from+' on network: '+config.irc.host,
				'Paste the following command in IRC to whisper your auth code to '+config.irc.nick+'. Replace PASS with a new password.',
				'',
				'/msg '+config.irc.nick+' !auth -c '+authCode+' '+resetUser+' PASS',
				'',
				'If you experience problems, please contact your channel\'s bot administrator. Replies to this email will be ignored.']
			bot.mailTransport.sendMail({
				from: config.irc.nick+' The IRC Bot <'+config.email.replyTo+'>',
				to: docs[0].email,
				subject: config.irc.nick+' IRC Password Reset Confirmation',
				text: emailMsg.join("\n"),
				html: '<p>'+emailMsg.join("</p><p>")+'</p>'
			}, function (err){
				if( err ){
					//log and report
					bot.log('MailError: '+err, 2);
					d$reset.reject('Unable to send email');
				}
				else{
					//report success and wait for auth code
					pendingResets[resetUser] = {
						code: authCode,
						attempts: 0
					};
					d$reset.resolve();
				}
			});
		}
	}).catch(function(err) {
		bot.log('Error during password reset request: '+err);
		d$reset.reject('Error during user lookup, please contact bot administrator for details');	
	});
	return d$reset.promise;
};

module.exports = {
	auth: auth
}