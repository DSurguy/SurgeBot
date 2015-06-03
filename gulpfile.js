var gulp = require('gulp'),
	mocha = require('gulp-mocha');

gulp.task('test', function(){

	var args = process.argv,
		fileIndex = args.indexOf('--f'),
		fileNames;

	if( fileIndex !== -1 ){
		fileNames = [];
		for( var i=fileIndex+1; args[i] && args[i].slice(0,2) !== '--'; i++ ){
			var thisFile = './test/'+args[i];
			if( args[i].slice(-3) !== '.js' ){
				thisFile += '.js';
			}
			fileNames.push(thisFile);
		}
	}
	gulp.src( fileNames ? fileNames : './test/*.js' )
		.pipe(mocha({
			reporter: 'dot'
		}))
		.once('error', function () {
            process.exit(1);
        })
        .once('end', function () {
            process.exit();
        });
});