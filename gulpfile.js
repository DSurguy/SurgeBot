var gulp = require('gulp'),
	mocha = require('gulp-mocha');

gulp.task('test', function(){
	gulp.src('./test/*.js')
		.pipe(mocha({
			reporter: 'spec'
		}))
		.once('error', function () {
            process.exit(1);
        })
        .once('end', function () {
            process.exit();
        });
});