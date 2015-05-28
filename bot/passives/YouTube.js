var https = require('https');

module.exports = YouTube;
function YouTube(client, services, config){
	this.client = client;
	this.services = services;
	this.config = config;
};
YouTube.prototype.handler = function(from, to, message, raw){
	var YouTube = this;
	YouTube.services['Log'].log('YouTube.handler: Starting handler.', 4);

	var videos = [];
	//gather all the video IDs
	var regex = new RegExp(/(youtu\.be\/)|(youtube\.com\/watch\?)/g);
	while( regex.test(message) ){
		YouTube.services['Log'].log('YouTube.handler: Parsing video string.', 4);
		//pull out the query string
		var slicedMsg = message.slice(regex.lastIndex);
		slicedMsg = slicedMsg.substring( 0, slicedMsg.search(/(\s|$)/g ) ).split(/[\&\?]/g);
		var timeString, videoID;
		YouTube.services['Log'].log('YouTube.handler: Split video params: '+JSON.stringify(slicedMsg), 4);
		for( var i=0; i<slicedMsg.length; i++ ){
			if( slicedMsg[i].search('v=') == 0 ){
				videoID = slicedMsg[i].slice(2);
			}
			else if( slicedMsg[i].search('t=') == 0 ){
				timeString = slicedMsg[i].slice(2);
			}
			else if( slicedMsg[i].search('=') == -1 ){
				//likely a youtu.be video ID
				videoID = slicedMsg[i];
			}
		}
		videos.push({
			ID: videoID,
			time: timeString
		});
	}

	//shoot a request for data to google for each video ID
	for( var i=0; i<videos.length; i++ ){
		var curVideo = videos[i];
		YouTube.services['Log'].log('YouTube.handler: Beginning connection to google data API.', 4);
		https.get('https://www.googleapis.com/youtube/v3/videos?part=snippet&id='+videos[i].ID+'&key='+YouTube.config.googleApi.key, function (res){
			var body = '';

			res.on('data', function (data){
				body += data;
			});

			res.on('end', function (){
				var vidData = JSON.parse(body);
				if( vidData.items[0] && vidData.items[0].snippet ){
					YouTube.services['Log'].log('YouTube.handler: Retrieved video data, responding to client.', 4);
					YouTube.client.say(to, '\x0303'+from+' linked a video: \x0310'
						+vidData.items[0].snippet.title
						+' (\x0312https://www.youtube.com/watch?v='
							+vidData.items[0].id
							+( curVideo.time ? '&t='+curVideo.time : '' )
						+'\x0301)');
				}
				else{
					YouTube.services['Log'].log('YouTube.handler: Detected video and contacted Google API, but loaded no data.', 4);
					YouTube.client.say(to, '\x0312Unable to load data for linked youtube video.');
				}
			});
		}).on( 'error', function (e){
			YouTube.services['Log'].error('YouTube.handler: Error contacting Youtube Data API: '+e.message);
		});
	}
}

YouTube.prototype.trigger = function(from, to, message, raw){
	return message.search(/(youtu\.be\/)|(youtube\.com\/watch\?)/g) !== -1;
};