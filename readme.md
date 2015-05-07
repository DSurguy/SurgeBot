Project Name: SurgeBot

Version: 0.0.1


# What IS SurgeBot?

SurgeBot is a nodejs-based IRC bot designed to provide fun and useful functions for IRC channels. He doesn't do much yet, because he's cloned from WoWIRCBot, which only has WoW-related functions.

# Bot Setup

## Prerequisites

### Source Code

The source code for the SurgeBot can be found here: 

    https://github.com/DSurguy/SurgeBot


Clone the repo or download the source as a zip (I recommend cloning the repo, this allows you to `git pull` and update things)

### NodeJS

To get started, please make sure you have node installed on your machine:

    http://nodejs.org/


## Building

This step isn’t so much a build process as it is dependency installation. Make sure you’ve got npm set up, and navigate to your SurgeBot directory. Then run `npm install`.

    cd ./SurgeBot
    npm install


### Configuration

Now for the fun part. Here you get to personalize your bot and make sure it’s going to connect where you want it to!

Secret.js

In your repo folder you’ll find a file called sampleSecret.js. Specifically, it’s located at:

    ./SurgeBot/bot/sampleSecret.js

This file contains all the connection information and administrative information for your specific bot.

#SurgeBot Command Reference
