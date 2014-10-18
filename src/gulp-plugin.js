var through = require('through2');
var gutil = require('gulp-util');
var path = require('path');
var deploy = require('./deploy-task');

/**
 * gulp plugin for deploying files to azure storage
 */
module.exports = function (opt) {
    var PLUGIN_NAME = 'gulp-deploy-azure-cdn ';
    var files = [];
    return through.obj(
        function (file, enc, cb) {
            var self = this;
            if (path.basename(file.path)[0] === '_') {
                return cb();
            }
            if (file.isNull()) {
                self.push(file);
                return cb();
            }
            if (file.isStream()) {
                self.emit('error', new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
                return cb();
            }
            files.push(file);
            return cb();
        },
        function (cb) {
            var self = this;
            var logger = gutil.log.bind(PLUGIN_NAME);
            try {
                deploy(opt, files, logger, function (err) {
                    if (err) {
                        self.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
                    }
                    console.log("FINISHED");
                    cb();
                })
            } catch (err) {
                self.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
                cb();
            }
        });
};
