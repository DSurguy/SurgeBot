var config = require('./config.js');

module.exports = Auth;
function Auth(client, log, services){
	this.client = client;
	this.log = log;
	this.docs = ["\x0311"+"Syntax: !auth [<user> <pass>]|[-r <email> <user>]|[-c <code> <user> <pass>]|[-p user]",
	    "This command can be used to register a username, with an associated email and password. Some secure ! commands require a user to be registered.",
	    "The base command of !auth <user> <pass> will attempt to login the user, provided they are registered.",
	    "The -r flag starts the registration process for a new user",
	    "The -c flag accepts a confirmation code sent in an email as part of the registration process or to reset a password.",
	    "The -p flag tells the bot to send a password reset code to the user's associated email.",
	    "\x0307NEVER PASTE YOUR PASSWORD IN A PUBLIC CHANNEL. \x0301Send !auth commands to the bot directly with /msg "+config.irc.nick+" !auth"];

    //check for required service
    if( services['User'] === undefined ){
    	//fail out
    	throw new Error('Auth module requires User service, service not found.');
    	return {};
    }
    else{
    	this.services = services;
    }
};

//!auth [-r <email> <user>]|[-c <code> <user> <pass>]|[<user> <pass>]|[-p user]
Auth.prototype.handler = function (from, to, params, raw){
	var Auth = this,
		argArray = params.split(/\s+/g),
		target = to,
		args;

	args = {
		pass: argArray.length == 2 ? argArray[1] : undefined,
		user: argArray.length == 2 ? argArray[0] : undefined
	};

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
		this.handleRegistration(args.regEmail, args.regUser, from).then(function (){
			//user is registered
			Auth.client.say(from, 'Registration request received. Please check the email you registered with for an auth code.'
				+' You can use the code with !auth -c <CODE> <USER> <PASS> to complete the registration process.');
		}, function (err){
			Auth.client.say(from, '\x0304-e- Error during registration: '+err+'. Please contact bot administrator for details.');
		});
	}
	else if( args.regFlag ){
		Auth.client.say(from, 'Malformed !auth. Expected !auth -r <email> <user>, but got '
			+'!auth -r <'+args.regEmail+'> <'+args.regUser+'>. Please enter a valid email and username to register.');
	}
	//Auth Code
	else if( args.code && args.codeUser && args.codePass ){
		if( this.pendingRegistrations[args.codeUser] ){
			//check if the code pasted matches
			if( this.pendingRegistrations[args.codeUser].code == args.code ){
				//this user is now registered, add them to the database and prompt for auth
				var newUser = this.pendingRegistrations[args.codeUser];
				this.addUser(args.codeUser, args.codePass, newUser.email).then(function(){
					//now prompt for auth since the user exists
					Auth.client.say(from, 'You are now registered to '+config.irc.nick+' as '+args.codeUser+'! Please auth with !auth <user> <pass> to complete login.');
				}).catch(function (err){
					//tell the user there was an error.
					Auth.client.say(from, '\x0304There was an error during registration. \x0301Please see the bot administrator for details.');
				});
			}
			else if( this.pendingRegistrations[args.codeUser].attempts == 2 ){
				//Too many invalid attempts. Remove the pending auth.
				Auth.log('User '+args.codeUser+' has failed too many auth code attempts.', 2);
				delete this.pendingRegistrations[args.codeUser];
				Auth.client.say('\x0304Too many invalid registration attempts have been detected. Your registration attempt has been removed and logged. Please see bot administrator for details.')
			}
			else{
				//log a failed attempt
				this.pendingRegistrations[args.codeUser].attempts++;
				Auth.client.say(from, '\x0304Invalid auth code. Please try again. You have '+(3-this.pendingRegistrations[args.codeUser].attempts)+' attempts remaining before the code is invalidated.');
			}
		}
		else if( this.pendingResets[args.codeUser] ){
			if( this.pendingResets[args.codeUser].code == args.code ){
				this.updatePassword(args.codeUser, args.codePass).then(function(){
					Auth.client.say(from, 'Your password has been updated. Please auth with !auth <user> <pass> to complete login.');
				}, function (err){
					Auth.client.say(from, '\x0304There was an error during the password reset process. \x0301Please see the bot administrator for details.');
				});
			}
			else if( this.pendingResets[args.codeUser].attempts == 2 ){
				//Too many invalid attempts. Remove the pending auth.
				Auth.log('User '+args.codeUser+' has failed too many auth code attempts.', 2);
				delete this.pendingResets[args.codeUser];
				Auth.client.say('\x0304Too many invalid password resets attempts have been detected. Your reset attempt has been removed and logged. Please see bot administrator for details.')
			}
			else{
				//log a failed attempt
				this.pendingResets[args.codeUser].attempts++;
				Auth.client.say(from, '\x0304Invalid auth code code. Please try again. You have '+(3-this.pendingResets[args.codeUser].attempts)+' attempts remaining before the code is invalidated.');
			}
		}
	}
	else if( args.codeFlag ){
		Auth.client.say(from, 'Malformed !auth. Expected !auth -c <code> <user> <newPassword>, but got '
			+'!auth -c <'+args.code+'> <'+args.codeUser+'> <'+args.codePass+'>. Please enter a valid email and username to register.');
	}
	//Password Reset
	else if( args.resetUser ){
		this.handleReset(args.resetUser, from, raw).then(function(){
			Auth.client.say(from, 'Password reset request received. Please check the email you registered with for an auth code.'
				+' You can use the code with !auth -c <CODE> <USER> <PASS> to complete the password reset process.');
		}, function (err){
			Auth.client.say(from, '\x0304There was an error during the password reset process. \x0301Please see the bot administrator for details.');
		});
	}
	else if( args.resetFlag ){
		Auth.client.say(from, 'Malformed !auth. Expected !auth -p <user>, but got '
			+'!auth -p <'+args.resetUser+'>. See !help auth for more information.');
	}
	//Login
	else if( args.user && args.pass ){
		this.handleLogin(args.user, args.pass, from, raw).then(function(){
			Auth.client.say(from, '\x0303You are now logged in as '+args.user+'. Welcome back!');
		}, function (err){
			Auth.client.say(from, '\x0304Error during login: '+err+'. Please see bot administrator for details.');
		});
	}
	else {
		//malformed request. Prompt help
		Auth.client.say(from, 'Malformed !auth. Expected !auth [-r <email> <user>]|[-c <code> <user> <pass>]|[<user> <pass>]|[-p user]. See \x0314!help auth \x0301for details.');
	}
};
Auth.prototype.authedUsers = {};
Auth.prototype.pendingRegistrations = {};
Auth.prototype.pendingResets = {};
Auth.prototype.generateAuthCode = function(){
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
Auth.prototype.addUser = function(name, pwd, email){

	var d$insert = Q.defer();

	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@'+config.mongo.url, function (err, db){
		var collection = db.collection('Users');

		collection.insert([{
			name: name,
			pwd: bcrypt.hashSync(pwd),
			email: email,
			currency: 1000
		}], function (err, result){
			if( err ){
				d$insert.reject(err);
			}
			else{
				d$insert.resolve(result);
			}
			db.close();
		});
	});

	//return the promise so things can listen for resolves and rejects
	return d$insert.promise;
};
Auth.prototype.updatePassword = function(name, pwd){
	var Auth = this,
		d$update = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@'+config.mongo.url, function (err, db){
		var collection = db.collection('Users');

		collection.update({name: name}, { $set: 
			{ pwd: bcrypt.hashSync(pwd) }
		}, function (err, result){
			if( err ){
				d$update.reject(err);
			}
			else{
				delete this.pendingResets[name];
				d$update.resolve(result);
			}
			db.close();
		});
	});
	return d$update.promise;
};

Auth.prototype.handleRegistration = function(regEmail, regUser, from){
	var Auth = this,
		d$registration = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@'+config.mongo.url, function (err, db){
		var collection = db.collection('Users');

		collection.find({ $or: [{name: regUser}, {email: regEmail}] }).toArray(function (err, docs){
			if( err ){
				Auth.log('Error during user registration: '+err);
				d$registration.reject('Error during user lookup, please contact bot administrator for details');
				db.close();
				return;
			}
			if( docs.length > 0 ){
				//this user exists, resolve the deferred object with the user data
				d$registration.reject('User or email already registered.');
			}
			else{
				//this user doesn't exists, start the registration process
				//check if this is a real email
				if( (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$/).test(regEmail) ){
					//generate an auth code for this user
					var authCode = this.generateAuthCode();

					//send the email
					var emailMsg = [config.irc.nick+' has received a registration request for the user '+regUser+' from the nick '+from+' on network: '+config.irc.host,
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
							Auth.log('MailError: '+err, 2);
							d$registration.reject('Unable to send email to '+regEmail);
						}
						else{
							//report success and wait for auth code
							this.pendingRegistrations[regUser] = {
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

			db.close();
		});
	});
	return d$registration.promise;
};

Auth.prototype.handleLogin = function(loginUser, loginPass, from, raw){
	var Auth = this,
		d$login = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@'+config.mongo.url, function (err, db){
		var collection = db.collection('Users');

		collection.find({name: loginUser}).toArray(function (err, docs){
			if( err ){
				Auth.log('Error during user registration: '+err);
				d$login.reject('Error during user lookup, please contact bot administrator for details');
				db.close();
				return;
			}
			if( docs == undefined ){
				//user does not exist
				d$login.reject('Username or password is incorrect. If you need a password reset, use !auth -p.');
			}
			else{
				if( this.authedUsers[loginUser] ){
					d$login.reject('User is already logged in.');
				}
				if( bcrypt.compareSync(loginPass, docs[0].pwd) ){
					//successful new login
					this.authedUsers[loginUser] = {
						session: raw.user+'@'+raw.host,
						currency: docs[0].currency
					};

					d$login.resolve();
				}
				else {
					//pass didn't match somehow
					d$login.reject('Username or password is incorrect. If you need a password reset, use !auth -p.')
				}
			}

			db.close();
		});
	});

	return d$login.promise;
};

Auth.prototype.handleReset = function(resetUser, from, raw){
	var Auth = this,
		d$reset = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@'+config.mongo.url, function (err, db){
		var collection = db.collection('Users');

		collection.find({ name: resetUser}).toArray(function (err, docs){
			if( err ){
				Auth.log('Error during password reset request: '+err);
				d$reset.reject('Error during user lookup, please contact bot administrator for details');
				db.close();
				return;
			}
			if( docs.length == 0 ){
				//this user doesn't exist, do nothing, but resolve to obscure user existance
				d$reset.resolve();
			}
			else{
				//this user exists, send an auth code and add them to pending resets
				var authCode = this.generateAuthCode();

				//send the email
				var emailMsg = [config.irc.nick+' has received a password reset request for the user '+resetUser+' from the nick '+from+' on network: '+config.irc.host,
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
						Auth.log('MailError: '+err, 2);
						d$reset.reject('Unable to send email');
					}
					else{
						//report success and wait for auth code
						this.pendingResets[resetUser] = {
							code: authCode,
							attempts: 0
						};
						d$reset.resolve();
					}
				});
			}

			db.close();
		});
	});
	return d$reset.promise;
};