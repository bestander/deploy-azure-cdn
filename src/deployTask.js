"use strict";
var Q = require('q');
var azure = require('azure');
var mime = require('mime');
var zlib = require('zlib');
var fs = require('fs');
var extend = require('node.extend');
var async = require('async');
var path = require('path');

function createAzureCdnContainer(blobService, options) {
    var deferred = Q.defer();
    blobService.createContainerIfNotExists(options.containerName, options.containerOptions, function (err) {
        if (err) {
            if (err.code === 'ContainerBeingDeleted') {
                deferred.reject("Container being deleted, retry in 10 seconds")
            }
            deferred.reject(err);
        }
        deferred.resolve();
    });
    return deferred.promise;
}

function noop() {
    var success = arguments[arguments.length - 1];
    success();
}

function emptyAzureCdnTargetFolder(blobService, options, logger) {
    var deferred = Q.defer();
    if(!options.deleteExistingBlobs){
        deferred.resolve();
    } else {
        // removing all blobs in destination structure
        blobService.listBlobs(options.containerName, {prefix: options.folder}, function (err, blobs) {
            if (err) {
                deferred.reject(err);
            }
            var count = blobs.length;
            if(count === 0){
                deferred.resolve();
            }
            blobs.forEach(function (blob, next) {
                logger("deleting file", blob.name);
                var exec = options.testRun ? noop : blobService.deleteBlob;
                exec.call(blobService, options.containerName, blob.name, function (err, success) {
                    if (err) {
                        logger("Error while deleting blob", blob.name);
                        deferred.reject(err);
                    }
                    logger("deleted", blob.url);
                    if(--count == 0){
                        deferred.resolve();
                    }
                });
            });

        });
    }
    return deferred.promise;
}

function uploadFileToAzureCdn(blobService, options, logger, destFileName, sourceFile, metadata) {
    var deferred = Q.defer();
    var exec = options.testRun ? noop : blobService.createBlockBlobFromFile;
    logger("Uploading", destFileName, "encoding", metadata.contentEncoding);
    exec.call(blobService, options.containerName, destFileName, sourceFile, metadata, function(err) {
        if (err) {
            deferred.reject(err);
        }
        logger("Uploaded", destFileName, "to", options.containerName);
        deferred.resolve();
    });
    return deferred.promise;
}

function chooseSmallerFileAndModifyContentType(compressedFile, originalFile, metadata) {
    var deferred = Q.defer();
    fs.stat(compressedFile, function (err, compressedStats) {
        if(err){
            deferred.reject(err);
            return;
        }
        fs.stat(originalFile, function (err, originalStats) {
            if(err){
                deferred.reject(err);
                return;
            }
            if(originalStats.size < compressedStats.size){
                // don't upload compressed if it becomes bigger
                deferred.resolve({
                    zippedTmpFile: compressedFile,
                    fileToUpload: originalFile,
                    updatedMetadata: metadata
                });
            } else {
                metadata.contentEncoding =  'gzip';
                deferred.resolve({
                    zippedTmpFile: compressedFile,
                    fileToUpload: compressedFile,
                    updatedMetadata: metadata
                });
            }
        });

    });
    return deferred.promise;
}

function gzipFile(source){
    var tempFile;
    var deferred = Q.defer(),
        gzip = zlib.createGzip({
            level: 9 // maximum compression
        }),
        inp,
        out;

    gzip.on('error', function(err) {
        deferred.reject(err);
    });
    inp = fs.createReadStream(source);
    tempFile = source + '.zip';
    out = fs.createWriteStream(tempFile);
    out.on('close', function() {
        deferred.resolve(tempFile);
    });
    inp.pipe(gzip).pipe(out);
    return deferred.promise;
}

function clone(obj) {
    if (null == obj || "object" != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        if (obj.hasOwnProperty(attr)) copy[attr] = obj[attr];
    }
    return copy;
}

module.exports = function deploy(opt, files, logger, cb) {
    var options = extend({}, {
        serviceOptions: [], // custom arguments to azure.createBlobService
        containerName: null, // container name, required
        containerOptions: {publicAccessLevel: "blob"}, // container options
        folder: '', // path within container
        deleteExistingBlobs: true, // true means recursively deleting anything under folder
        concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
        zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
        metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
        testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
    }, opt);
    if (!options.containerName) {
        return cb("Missing containerName!");
    }
    var blobService = azure.createBlobService.apply(azure, options.serviceOptions);

    var preparation = createAzureCdnContainer(blobService, options).
        then(function() {
            return emptyAzureCdnTargetFolder(blobService, options, logger);
        });
    async.eachLimit(files, options.concurrentUploadThreads, function(file, eachCallback) {
        var relativePath = file.path.replace(file.cwd + path.sep, '');
        var destFileName = options.folder + relativePath;
        var sourceFile = file.path;
        var metadata = clone(options.metadata);
        metadata.contentType = mime.lookup(sourceFile);
        if (options.zip) {
            preparation.then(function () {
                return gzipFile(sourceFile)
            }).then(function (tmpFile) {
                return chooseSmallerFileAndModifyContentType(tmpFile, sourceFile, metadata);
            }).then(function (res) {
                return uploadFileToAzureCdn(blobService, options, logger, destFileName, res.fileToUpload, res.updatedMetadata)
                    .finally(function () {
                        fs.unlinkSync(res.zippedTmpFile);
                    });
            }).then(function(){
                eachCallback();
            }).catch(function (error) {
                eachCallback(error);
            });
        } else {
            preparation.then(function () {
                return uploadFileToAzureCdn(blobService, options, logger, destFileName, sourceFile, metadata)
            }).then(function(){
                eachCallback();
            }).catch(function (error) {
                eachCallback(error);
            });
        }
    }, function(err) {
        cb(err);
    });
};

