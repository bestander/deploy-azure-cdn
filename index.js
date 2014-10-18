"use strict";
var deploy = require('./src/deploy-task');
var gulpPlugin = require('./src/gulp-plugin');

module.exports = {
    gulpPlugin: gulpPlugin,
    vanilla: deploy
};
