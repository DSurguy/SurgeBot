var config = require('./config.js'),
	Clone = require('./Clone.js');

module.exports = UserService;
function UserService(log){
	this._activeUsers = {};
	this._pendingReset = {};
	this._pendingRegistration = {};
	this.log = log;
	this.schema = {
		currency: 1000
	};
};

UserService.prototype.getUserStatus = function(user){
	if(  )
};

UserService.prototype._C = {
	LOGIN_USERNOTEXIST: 0,
	LOGIN_USERACTIVESESSION: 1,
	LOGIN_USERPASSFAIL: 2,

	REGISTER_USERREGISTERED: 0,
	REGISTER_EMAILERROR: 1,
	REGISTER_INVALIDEMAIL: 2,
	REGISTER_INSERTERROR: 3,

	STATUS_NOTAUTHED: 0,
	STATUS_PENDINGREGISTRATION: 1,
	STATUS_AUTHED: 2
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

UserService.prototype.startRegistration = function(user, email, fromNick){
	var UserService = this,
		d$registration = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@'+config.mongo.url, function (err, db){
		var collection = db.collection('Users');

		collection.find({ $or: [{name: user}, {email: email}] }).toArray(function (err, docs){
			if( err ){
				UserService.log(err, 2);
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
					var emailMsg = [config.irc.nick+' has received a registration request for the user '+user+' from the nick '+fromNick+' on network: '+config.irc.host,
						'Paste the following command in IRC to whisper your registration code to '+config.irc.nick+'. Replace PASS with a new password.',
						'',
						'/msg '+config.irc.nick+' !auth -c '+authCode+' '+user+' PASS',
						'',
						'If you experience problems, please contact your channel\'s bot administrator. Replies to this email will be ignored.']
					bot.mailTransport.sendMail({
						from: config.irc.nick+' The IRC Bot <'+config.email.replyTo+'>',
						to: email,
						subject: config.irc.nick+' IRC Registration Confirmation',
						text: emailMsg.join("\n"),
						html: '<p>'+emailMsg.join("</p><p>")+'</p>'
					}, function (err){
						if( err ){
							UserService.log(err, 2);
							d$registration.reject(1);
						}
						else{
							//report success and wait for auth code
							this._pendingRegistrations[user] = {
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
UserService.prototype.endRegistration = function(user, pwd, authCode){
	var UserService = this,
		pendingUser = UserService._pendingRegistrations[args.codeUser]
		d$insert = Q.defer();

	if( pendingUser && pendingUser.code == authCode ){
		//this user is now registered, add them to the database and prompt for auth
		var newUser = UserService._createNewUser(user, pwd, pendingUser.email);

		Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@'+config.mongo.url, function (err, db){
			var collection = db.collection('Users');

			collection.insert([newUser], function (err, result){
				if( err ){
					UserService.log(err, 2);
					d$insert.reject();
				}
				else{
					d$insert.resolve(result);
				}
				db.close();
			});
		});
	}

	//return the promise so things can listen for resolves and rejects
	return d$insert.promise;
};

UserService.prototype.createNewUser = function(user, pwd, email){
	var newUser = Clone(this.addlUserSchema);

	newUser.name = user;
	newUser.pwd = bcrypt.hashSync(pwd);
	newUser.email = email;
};

UserService.prototype.login = function(user, pwd, session){
	var userService = this,
		d$login = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@'+config.mongo.url, function (err, db){
		var collection = db.collection('Users');

		collection.find({name: user}).toArray(function (err, docs){
			if( err ){
				UserService.log(err, 2);
				d$login.reject(err);
				db.close();
				return;
			}
			if( docs == undefined ){
				//user does not exist
				d$login.reject(0);
			}
			else{
				if( userService.activeUsers[user] ){
					d$login.reject(1);
				}
				if( bcrypt.compareSync(loginPass, docs[0].pwd) ){
					//successful new login, pull down user data
					userService.activeUsers[user] = {
						session: session
					};
					for( var prop in docs[0] ){
						if( docs[0].hasOwnProperty(prop) && ['pwd', '_id', 'session'].search(prop) == -1 ){
							userService.activeUsers[user][prop] = docs[0][prop];
						}
					}

					d$login.resolve();
				}
				else {
					//pass didn't match somehow
					d$login.reject(2);
				}
			}

			db.close();
		});
	});

	return d$login.promise;
};

UserService.prototype.resetPassword = function(user, newPwd){

};

UserService.createNewUser = function(user, pwd){
	
};