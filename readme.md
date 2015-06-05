##Tests
Running tests is simple, just run the following two commands and you should be up and running:

    npm install
    npm test

Also feel free to hit gulp directly after doing `npm install`

    gulp test

####Test Specific Files
The gulp task that runs the tests supports a file argument. You can specify any number of test files to run individually, instead of running the entire test suite. This can speed up the development process a bit if you're making code changes. The .js extension is optional.

    gulp test --f DocService LogService.js
