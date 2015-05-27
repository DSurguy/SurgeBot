module.exports = Auth;
function Auth(client, services, config){
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
		Auth.services['User'].promptRegistration(args.regUser, args.regEmail, from).then(function (){
			//user is registered
			Auth.client.say(from, 'Registration request received. Please check the email you registered with for an auth code.'
				+' You can use the code with !auth -c <CODE> <USER> <PASS> to complete the registration process.');
		}, function (err){
			var userMessage = '';
			switch(err){
				case Auth.services['User'].REGISTER_USERREGISTERED:
					userMessage = 'User already registered';
				break;
				case Auth.services['User'].REGISTER_EMAILERROR:
					userMessage = 'Error attempting to send email';
				break;
				case Auth.services['User'].REGISTER_INVALIDEMAIL:
					userMessage = 'Invalid email';
				break;
				default:
					userMessage = 'Database error';
				break;
			}
			Auth.client.say(from, '\x0304-e- Error during registration: '+userMessage+'. Please contact bot administrator for details.');
		});
	}
	else if( args.regFlag ){
		Auth.client.say(from, 'Malformed !auth. Expected !auth -r <email> <user>, but got '
			+'!auth -r <'+args.regEmail+'> <'+args.regUser+'>. Please enter a valid email and username to register.');
	}
	//Auth Code
	else if( args.code && args.codeUser && args.codePass ){
		if( Auth.services['User'].getUserRegistrationStatus(args.codeUser) == 1 ){
			//attempt to complete registration
			Auth.services['User'].attemptRegistration(args.codeUser, args.codePass, args.code).then(function(){
				Auth.client.say(from, 'You are now registered to '+config.irc.nick+' as '+args.codeUser+'! Please auth with !auth <user> <pass> to complete login.');
			}, function (err){
				var userMessage = '';
				switch(err){
					case Auth.services['User'].REGISTER_INVALIDCODE:
						userMessage = 'Invalid auth code';
					break;
					case Auth.services['User'].REGISTER_NOTPENDING:
						userMessage = 'User is not pending registration';
					break;
					case Auth.services['User'].REGISTER_TOOMANYATTEMPTS:
						userMessage = 'Invalid auth code. Too many invalid auth attempts, registration process aborted.';
					break;
					default:
						userMessage = 'Database error';
					break;
				}
				Auth.client.say(from, '\x0304-e- Error during registration: '+userMessage+'. Please contact bot administrator for details.');
			});
		}
		else if( Auth.services['User'].getUserResetStatus(args.codeUser) == 1 ){
			//attempt to complete reset
			Auth.services['User'].attemptReset(args.codeUser, args.codePass, args.code).then(function(){
				Auth.client.say(from, 'Password has been reset! Please auth with !auth <user> <pass> to complete login.');
			}, function (err){
				var userMessage = '';
				switch(err){
					case Auth.services['User'].REGISTER_INVALIDCODE:
						userMessage = 'Invalid auth code';
					break;
					case Auth.services['User'].REGISTER_NOTPENDING:
						userMessage = 'User is not pending password reset';
					break;
					case Auth.services['User'].REGISTER_TOOMANYATTEMPTS:
						userMessage = 'Invalid auth code. Too many invalid auth attempts, password reset process aborted.';
					break;
					default:
						userMessage = 'Database error';
					break;
				}
				Auth.client.say(from, '\x0304-e- Error during password reset: '+userMessage+'. Please contact bot administrator for details.');
			});
		}
	}
	else if( args.codeFlag ){
		Auth.client.say(from, 'Malformed !auth. Expected !auth -c <code> <user> <newPassword>, but got '
			+'!auth -c <'+args.code+'> <'+args.codeUser+'> <'+args.codePass+'>. Please enter a valid email and username to register.');
	}
	//Password Reset
	else if( args.resetUser ){
		Auth.services['User'].promptReset(args.regUser, from).then(function (){
			//user is registered
			Auth.client.say(from, 'Password reset request received. Please check the email you registered with for an auth code.'
				+' You can use the code with !auth -c <CODE> <USER> <PASS> to complete the reset process.');
		}, function (err){
			var userMessage = '';
			switch(err){
				case Auth.services['User'].RESET_USERNOTEXIST:
					userMessage = 'User does not exist';
				break;
				case Auth.services['User'].RESET_EMAILERROR:
					userMessage = 'Error attempting to send email';
				break;
				default:
					userMessage = 'Database error';
				break;
			}
			Auth.client.say(from, '\x0304-e- Error during password reset: '+userMessage+'. Please contact bot administrator for details.');
		});
	}
	else if( args.resetFlag ){
		Auth.client.say(from, 'Malformed !auth. Expected !auth -p <user>, but got '
			+'!auth -p <'+args.resetUser+'>. See !help auth for more information.');
	}
	//Login
	else if( args.user && args.pass ){
		Auth.services['User'].login(args.user, args.pass, raw.user+'@'+raw.host).then(function(){
			Auth.client.say(from, '\x0303You are now logged in as '+args.user+'.');
		}, function (err){
			var userMessage = '';
			switch(err){
				case Auth.services['User'].LOGIN_USERNOTEXIST:
					userMessage = 'Username or password incorrect';
				break;
				case Auth.services['User'].LOGIN_USERACTIVESESSION:
					userMessage = 'User is already logged in. Complete a password reset to log out active session';
				break;
				case Auth.services['User'].LOGIN_USERPASSFAIL:
					userMessage = 'Username or password incorrect';
				break;
				default:
					userMessage = 'Database error';
				break;
			}
			Auth.client.say(from, '\x0304-e- Error during login: '+userMessage+'. Please contact bot administrator for details.');
		});
	}
	else {
		//malformed request. Prompt help
		Auth.client.say(from, 'Malformed !auth. Expected !auth [-r <email> <user>]|[-c <code> <user> <pass>]|[<user> <pass>]|[-p user]. See \x0314!help auth \x0301for details.');
	}
};