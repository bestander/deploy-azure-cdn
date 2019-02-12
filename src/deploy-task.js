"use strict";
var Q = require('q');
var azure = require('azure-storage');
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
            return;
        }
        deferred.resolve();
    });
    return deferred.promise;
}

function noop() {
    var success = arguments[arguments.length - 1];
    success();
}

function emptyAzureCdnTargetFolder(blobService, options, loggerCallback) {
    var deferred = Q.defer();
    if (!options.deleteExistingBlobs) {
        deferred.resolve();
    } else {
        // removing all blobs in destination structure
        blobService.listBlobsSegmentedWithPrefix(options.containerName, options.folder, null, function (err, blobs) {
            if (err) {
                deferred.reject(err);
                return;
            }
            var count = blobs.entries.length;
            if (count === 0) {
                deferred.resolve();
            }
            blobs.entries.forEach(function (blob, next) {
                loggerCallback("deleting file", blob.name);
                var exec = options.testRun ? noop : blobService.deleteBlob;
                exec.call(blobService, options.containerName, blob.name, function (err, success) {
                    if (err) {
                        loggerCallback("Error while deleting blob", blob.name);
                        deferred.reject(err);
                        return;
                    }
                    loggerCallback("deleted", blob.name);
                    if (--count == 0) {
                        deferred.resolve();
                    }
                });
            });

        });
    }
    return deferred.promise;
}

function uploadFileToAzureCdn(blobService, options, loggerCallback, destFileName, sourceFile, metadata) {
    var deferred = Q.defer();
    var exec = options.testRun ? noop : blobService.createBlockBlobFromLocalFile;
    loggerCallback("Uploading", destFileName, "encoding", metadata.contentEncoding);
    exec.call(blobService, options.containerName, destFileName, sourceFile, {contentSettings: metadata}, function (err) {
        if (err) {
            deferred.reject(err);
            return;
        }
        loggerCallback("Uploaded", destFileName, "to", options.containerName);
        deferred.resolve();
    });
    return deferred.promise;
}

function chooseSmallerFileAndModifyContentType(compressedFile, originalFile, metadata) {
    var deferred = Q.defer();
    fs.stat(compressedFile, function (err, compressedStats) {
        if (err) {
            deferred.reject(err);
            return;
        }
        fs.stat(originalFile, function (err, originalStats) {
            if (err) {
                deferred.reject(err);
                return;
            }
            if (originalStats.size < compressedStats.size) {
                // don't upload compressed if it becomes bigger
                deferred.resolve({
                    zippedTmpFile: compressedFile,
                    fileToUpload: originalFile,
                    updatedMetadata: metadata
                });
            } else {
                metadata.contentEncoding = 'gzip';
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

function gzipFile(source) {
    var tempFile;
    var deferred = Q.defer();
    var gzip = zlib.createGzip({
        level: 9 // maximum compression
    });
    var inp;
    var out;
    gzip.on('error', function (err) {
        deferred.reject(err);
    });

    inp = fs.createReadStream(source);
    tempFile = source + '.zip';
    out = fs.createWriteStream(tempFile);
    out.on('close', function () {
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

/**
 * deploy files to azure blob storage
 * @param opt - deployment options
 * @param files - array of vynil files
 * @param loggerCallback - callback function that can be used for logging, some important progress is sent as first argument to this callback
 * @param cb - standard node.js callback. If first parameter is undefined then upload is successful
 ` */
module.exports = function deploy(opt, files, loggerCallback, cb) {
    var options = extend(true, {}, {
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

    var createFolderAndClearPromise = createAzureCdnContainer(blobService, options).
        then(function () {
            return emptyAzureCdnTargetFolder(blobService, options, loggerCallback);
        });
    // allow deleting files without anything to upload
    if (files.length === 0) {
        createFolderAndClearPromise.then(cb, cb);
        return;
    }
    async.eachLimit(files, options.concurrentUploadThreads, function (file, eachCallback) {
        if(file.cwd && !file.base){
          loggerCallback('[WARNING] `cwd` is deprecated. please use `base` in your files');
        }

        var dir = file.base || file.cwd;
        var relativePath = dir ? path.relative(dir, file.path) : path.basename(file.path);
        var destFileName = path.join(options.folder, file.dest || relativePath);
        var sourceFile = file.path;
        var metadata = clone(options.metadata);
        metadata.contentType = mime.getType(sourceFile);
        if (options.zip) {
            createFolderAndClearPromise.then(function () {
                return gzipFile(sourceFile)
            }).then(function (tmpFile) {
                return chooseSmallerFileAndModifyContentType(tmpFile, sourceFile, metadata);
            }).then(function (res) {
                return uploadFileToAzureCdn(blobService, options, loggerCallback, destFileName, res.fileToUpload, res.updatedMetadata)
                    .finally(function () {
                        fs.unlinkSync(res.zippedTmpFile);
                    });
            }).then(function () {
                eachCallback();
            }).catch(function (error) {
                eachCallback(error);
            });
        } else {
            createFolderAndClearPromise.then(function () {
                return uploadFileToAzureCdn(blobService, options, loggerCallback, destFileName, sourceFile, metadata)
            }).then(function () {
                eachCallback();
            }).catch(function (error) {
                eachCallback(error);
            });
        }
    }, function (err) {
        cb(err);
    });
};
