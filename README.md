Last edited: 12th March '23

# Summary
CloudFileStorage is a node applicaiton built in Typescript designed to service as the business logic layer for storing customer files off of the salesforce Platform.

# Dev setup
Since this service is run on heroku we can take advantage of `heroku local` for development.
To run cloudfilestorage locally follow these steps:
## download the heroku cli tool
### for mac
`brew tap heroku/brew && brew install heroku`
### for windows
`https://devcenter.heroku.com/articles/heroku-cli`
## move environment variables to your local.
From within the directory that you have the CloudFileStorage code run:
  - Make a file called `.env` in the root of the repo. ie. `cat .env`
  - Run `heroku config:get CONFIG-VAR-NAME -s  >> .env` for every heroku Environment Variable.
  - `heroku config:get AWS_ACCESS_KEY_ID -s  >> .env`
  - `heroku config:get AWS_SECRET_ACCESS_KEY -s  >> .env`
  - `heroku config:get CLOUDFRONT_SIGNED_URL_KEY -s  >> .env`
  - `heroku config:get CLOUDFRONT_SIGNED_URL_KEY_GROUP -s  >> .env`
  - `heroku config:get REDIS_TLS_URL -s  >> .env`
  - `heroku config:get REDIS_URL -s  >> .env`
## build/compile your code
  - `npm install` this will do a lot of stuff and it will create a `./build` directory for you but if it doesn't create a `./build` directory run `npm run-script build`.
  - `npm run-script start_heroku` This will start the webserver and use the Environment Variables that are on the server.
## change and modify code and test it
  - first you have to stop heroku, the only way todo that is `Ctrl + c` in the terminal
  - next you need to delete the `./build` directory `npm run-script remove_build`
  - rebuild `npm run-script build`
  - restart heroku `npm run-script start_heroku`

With that setup, use postman to hit endpoints on `localhost:3030`.
Parameters in the SF request body can be 'mocked' in Body > Raw in `JSON` format.
