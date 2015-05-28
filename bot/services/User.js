var extend = require('extend'),
	nodemailer = require('nodemailer'),
	Mongo = require('mongodb'),
	Q = require('q'),
	bcrypt = require('bcrypt-nodejs');

module.exports = UserService;
function UserService(services, config){
	this._activeUsers = {};
	this._pendingReset = {};
	this._pendingRegistrations = {};
	this.services = services;
	this.userSchema = {
		currency: 1000
	};
	this.config = config;

	/** 
	*	Some constants to provide additional human-readability
	*	when checking errors or status
	*/
	this.LOGIN_USERNOTEXIST = 0;
	this.LOGIN_USERACTIVESESSION = 1;
	this.LOGIN_USERPASSFAIL = 2;
	this.REGISTER_USERREGISTERED = 0;
	this.REGISTER_EMAILERROR = 1;
	this.REGISTER_INVALIDEMAIL = 2;
	this.REGISTER_INSERTERROR = 3;
	this.REGISTER_INVALIDCODE = 4;
	this.REGISTER_NOTPENDING = 5;
	this.REGISTER_TOOMANYATTEMPTS = 6;
	this.RESET_USERNOTEXIST = 0;
	this.RESET_EMAILERROR = 1;
	this.RESET_NOTPENDING = 2;
	this.RESET_INVALIDCODE = 3;
	this.RESET_TOOMANYATTEMPTS = 4;
	this.STATUS_NOTAUTHED = 0;
	this.STATUS_PENDINGREGISTRATION = 1;
	this.STATUS_AUTHED = 2;
	this.STATUS_NORESET = 0;
	this.STATUS_PENDINGRESET = 1;
	this.EMAIL_NOTCONFIGURED = -1;

	if( config.email ){
		this.mailTransport = nodemailer.createTransport({
			service: config.email.service,
			port: config.email.port,
			host: config.email.host,
			secure: config.email.secure,
			auth: {
				user: config.email.username,
				pass: config.email.password
			}
		});
	}
	else{
		throw new Error('config.email does not exist, users cannot be registered');
	}
};

UserService.prototype.getUserRegistrationStatus = function(user){
	if( this._activeUsers[user] ){
		return 2;
	}
	else if( this._pendingRegistrations[user] ){
		return 1;
	}
	else {
		return 0;
	}
};

UserService.prototype.getUserResetStatus = function(user){
	if( this._pendingReset[user] ){
		return 1;
	}
	else{
		return 0;
	}
};

UserService.prototype.generateAuthCode = function(){
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

UserService.prototype.promptRegistration = function(user, email, fromNick){
	var UserService = this,
		d$registration = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+UserService.config.mongo.user+':'+UserService.config.mongo.pass+'@'+UserService.config.mongo.url, function (err, db){
		var collection = db.collection('Users');

		collection.find({ $or: [{name: user}, {email: email}] }).toArray(function (err, docs){
			if( err ){
				UserService.services['Log'].error(err, 2);
				d$registration.reject(err);
				db.close();
				return;
			}
			if( docs.length > 0 ){
				//this user exists, resolve the deferred object with the user data
				d$registration.reject(0);
			}
			else{
				//this user doesn't exists, start the registration process
				//check if this is a real email
				if( (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$/).test(email) ){
					//generate an auth code for this user
					var authCode = UserService.generateAuthCode();

					//send the email
					var emailMsg = [UserService.services['IrcSession'].nick+' has received a registration request for the user '+user+' from the nick '+fromNick+' on network: '+UserService.config.irc.host,
						'Paste the following command in IRC to whisper your registration code to '+UserService.services['IrcSession'].nick+'. Replace PASS with a new password.',
						'',
						'/msg '+UserService.services['IrcSession'].nick+' !auth -c '+authCode+' '+user+' PASS',
						'',
						'If you experience problems, please contact your channel\'s bot administrator. Replies to this email will be ignored.'];
					UserService.mailTransport.sendMail({
						from: UserService.services['IrcSession'].nick+' The IRC Bot <'+UserService.config.email.replyTo+'>',
						to: email,
						subject: UserService.services['IrcSession'].nick+' IRC Registration Confirmation',
						text: emailMsg.join("\n"),
						html: '<p>'+emailMsg.join("</p><p>")+'</p>'
					}, function (err){
						if( err ){
							UserService.services['Log'].error(err, 2);
							d$registration.reject(1);
						}
						else{
							//report success and wait for auth code
							UserService._pendingRegistrations[user] = {
								code: authCode,
								email: email,
								attempts: 0
							};
							d$registration.resolve();
						}
					});
				}
				else{
					//please enter a real email or password
					d$registration.reject(2);
				}
			}

			db.close();
		});
	});
	return d$registration.promise;
};
UserService.prototype.attemptRegistration = function(user, pwd, authCode){
	var UserService = this,
		pendingUser = UserService._pendingRegistrations[user],
		d$update = Q.defer();

	UserService.services['Log'].log('UserService.attemptRegistration: starting. '+JSON.stringify(arguments), 4);

	if( pendingUser && pendingUser.code == authCode ){
		UserService.services['Log'].log('UserService.attemptRegistration: User pending and matched code. ', 4);
		//this user is now registered, add them to the database and prompt for auth
		var newUser = UserService.createNewUser(user, pwd, pendingUser.email);

		Mongo.connect('mongodb://'+UserService.config.mongo.user+':'+UserService.config.mongo.pass+'@'+UserService.config.mongo.url, function (err, db){
			UserService.services['Log'].log('UserService.attemptRegistration: Connected to mongo. ', 4);
			var collection = db.collection('Users');

			collection.insert([newUser], function (err, result){
				UserService.services['Log'].log('UserService.attemptRegistration: Completed db insert. ', 4);
				if( err ){
					UserService.services['Log'].error(err, 2);
					d$update.reject();
				}
				else{
					UserService.services['Log'].log('UserService.attemptRegistration: Successfully registered user, resolving. ', 4);
					d$update.resolve(result);
				}
				db.close();
			});
		});
	}
	else if( pendingUser ){
		UserService.services['Log'].log('UserService.attemptRegistration: User pending but didn\'t match code. ', 4);
		//the code didn't match, increment the attempts
		pendingUser.attempts++;
		if( pendingUser.attempts >= 3 ){
			UserService.services['Log'].log('UserService.attemptRegistration: Too many auth attempts, deleting and rejecting. ', 4);
			//too many attempts. Delete pending reset
			delete UserService._pendingRegistrations[user];
			d$update.reject(6);
		}
		else{
			//still attempts left
			UserService.services['Log'].log('UserService.attemptRegistration: Pending, but didn\'t match code, rejecting. ', 4);
			d$update.reject(4);
		}
	}
	else{
		//user is not pending registration
		UserService.services['Log'].log('UserService.attemptRegistration: User not pending, rejecting. ', 4);
		d$update.reject(5);
	}

	//return the promise so things can listen for resolves and rejects
	return d$update.promise;
};

UserService.prototype.createNewUser = function(user, pwd, email){
	var newUser = extend(true, {}, this.userSchema);

	newUser.name = user;
	newUser.pwd = bcrypt.hashSync(pwd);
	newUser.email = email;

	return newUser;
};

UserService.prototype.login = function(user, pwd, session){
	var UserService = this,
		d$login = Q.defer();

	UserService.services['Log'].log('UserService.login: starting. '+JSON.stringify(arguments), 4);

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+UserService.config.mongo.user+':'+UserService.config.mongo.pass+'@'+UserService.config.mongo.url, function (err, db){
		if( err ){
			UserService.services['Log'].log(err, 2);
			d$login.reject(err);
			db.close();
			return;
		}
		UserService.services['Log'].log('UserService.login: connected to mongo', 4);
		var collection = db.collection('Users');

		collection.find({name: user}).toArray(function (err, docs){
			if( err ){
				UserService.services['Log'].log(err, 2);
				d$login.reject(err);
				db.close();
				return;
			}
			UserService.services['Log'].log('UserService.login: Completed find on collection.', 4);
			if( docs == undefined ){
				//user does not exist
				UserService.services['Log'].log('UserService.login: User does not exist, rejecting.', 4);
				d$login.reject(0);
			}
			else{
				if( UserService._activeUsers[user] ){
					UserService.services['Log'].log('UserService.login: User already logged in, rejecting.', 4);
					d$login.reject(1);
				}
				if( bcrypt.compareSync(pwd, docs[0].pwd) ){
					//successful new login, pull down user data
					UserService.services['Log'].log('UserService.login: Auth success, adding user session.', 4);
					UserService._activeUsers[user] = {
						session: session
					};
					for( var prop in docs[0] ){
						if( docs[0].hasOwnProperty(prop) && ['pwd', '_id', 'session'].indexOf(prop) == -1 ){
							UserService._activeUsers[user][prop] = docs[0][prop];
						}
					}

					UserService.services['Log'].log('UserService.login: User added to session, resolving.', 4);
					d$login.resolve();
				}
				else {
					//pass didn't match somehow
					UserService.services['Log'].log('UserService.login: Password incorrect, rejecting.', 4);
					d$login.reject(2);
				}
			}

			db.close();
		});
	});

	return d$login.promise;
};

UserService.prototype.promptReset = function(user, fromNick){
	var UserService = this,
		d$reset = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+UserService.config.mongo.user+':'+UserService.config.mongo.pass+'@'+UserService.config.mongo.url, function (err, db){
		var collection = db.collection('Users');

		collection.find({ name: user}).toArray(function (err, docs){
			if( err ){
				UserService.services['Log'].error('Error during password reset request: '+err);
				d$reset.reject(err);
			}
			else if( docs.length == 0 ){
				//this user doesn't exist, do nothing, but resolve to obscure user existance
				d$reset.reject(0);
			}
			else{
				//this user exists, send an auth code and add them to pending resets
				var authCode = UserService.generateAuthCode();

				//send the email
				var emailMsg = [UserService.services['IrcSession'].nick+' has received a password reset request for the user '+user+' from the nick '+from+' on network: '+UserService.config.irc.host,
					'Paste the following command in IRC to whisper your auth code to '+UserService.services['IrcSession'].nick+'. Replace PASS with a new password.',
					'',
					'/msg '+UserService.services['IrcSession'].nick+' !auth -c '+authCode+' '+user+' PASS',
					'',
					'If you experience problems, please contact your channel\'s bot administrator. Replies to this email will be ignored.']
				UserService.mailTransport.sendMail({
					from: UserService.services['IrcSession'].nick+' The IRC Bot <'+UserService.config.email.replyTo+'>',
					to: docs[0].email,
					subject: UserService.services['IrcSession'].nick+' IRC Password Reset Confirmation',
					text: emailMsg.join("\n"),
					html: '<p>'+emailMsg.join("</p><p>")+'</p>'
				}, function (err){
					if( err ){
						//log and report
						UserService.services['Log'].error('MailError: '+err, 2);
						d$reset.reject(1);
					}
					else{
						//report success and wait for auth code
						UserService._pendingResets[users] = {
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
UserService.prototype.attemptReset = function(user, pwd, authCode){
	var UserService = this,
		pendingUser = UserService._pendingReset[user],
		d$insert = Q.defer();

	if( pendingUser && pendingUser.code == authCode ){
		//this user is now registered, add them to the database and prompt for auth

		Mongo.connect('mongodb://'+UserService.config.mongo.user+':'+UserService.config.mongo.pass+'@'+UserService.config.mongo.url, function (err, db){
			var collection = db.collection('Users');

			collection.update({name: user}, { $set: 
				{ pwd: bcrypt.hashSync(pwd) }
			}, function (err, result){
				if( err ){
					d$update.reject(err);
				}
				else{
					delete UserService._pendingReset[user];
					d$update.resolve(result);
				}
				db.close();
			});
		});
	}
	else if( pendingUser ){
		//the code didn't match, increment the attempts
		pendingUser.attempts++;
		if( pendingUser.attempts >= 3 ){
			//too many attempts. Delete pending reset
			delete UserService._pendingReset[user];
			d$update.reject(4);
		}
		else{
			//still attempts left
			d$update.reject(3);
		}
	}
	else{
		//user is not pending registration
		d$insert.reject(2);
	}

	//return the promise so things can listen for resolves and rejects
	return d$insert.promise;
};