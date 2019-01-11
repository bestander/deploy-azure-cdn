"use strict";
// otherwise it starts mocking all node packages
jest.autoMockOff();
jest.useFakeTimers();

describe('Azure Deploy Task', function () {

    it('should upload files as is, with no zipping, if zip option is false', function () {
        jest.mock('azure-storage');
        jest.mock('zlib');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var zlib = require('zlib');
        var files = [
            {cwd: '/project', path: '/project/dist/file1.js'},
            {cwd: '/project', path: '/project/dist/file2.js'}
        ];
        var logger = jest.fn();
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: 'path/in/cdn', // path within container
            deleteExistingBlobs: false, // true means recursively deleting anything under folder
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback();
        });
        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(azure.createBlobService().createBlockBlobFromLocalFile).toBeCalled();
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][0]).toBe(opts.containerName);
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][1]).toBe('path/in/cdn/dist/file1.js');
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][2]).toBe('/project/dist/file1.js');
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][3]).toEqual({
            contentSettings: {
                cacheControl: 'public, max-age=31556926',
                contentType: 'application/javascript'
            }
        });
        expect(zlib.createGzip).not.toBeCalled();
    });

    it('should gzip files and if size of zipped file is bigger it should upload the original file, if zip option is true', function () {
        jest.mock('azure-storage');
        jest.mock('zlib');
        jest.mock('fs');
        var fs = require('fs');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var zlib = require('zlib');
        var files = [
            {cwd: '/project', path: '/project/dist/file1.js'}
        ];
        var logger = jest.fn();
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: 'path/in/cdn', // path within container
            deleteExistingBlobs: false, // true means recursively deleting anything under folder
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            zip: true, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        zlib.createGzip = jest.fn().mockReturnValue({on: jest.fn()});
        azure.createBlobService().createBlockBlobFromLocalFile.mockClear();
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback();
        });
        azure.createBlobService().createBlockBlobFromLocalFile.mockImplementation(function (param1, param2, param3, param4, callback) {
            callback();
        });
        fs.createReadStream = jest.fn().mockReturnValue({
            pipe: jest.fn().mockReturnThis()
        });
        fs.createWriteStream = jest.fn().mockReturnValue({
            on: function(event, cb){
                if(event === 'close'){
                    cb();
                }
            },
            pipe: jest.fn().mockReturnThis()
        });
        fs.stat = jest.fn().mockImplementation(function(file, callback){
            if(file === '/project/dist/file1.js'){
                callback(null, {size: 100});
            }
            if(file === '/project/dist/file1.js.zip'){
                callback(null, {size: 101});
            }
        });
        fs.unlinkSync = jest.fn();

        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(zlib.createGzip).toBeCalled();
        expect(azure.createBlobService().createBlockBlobFromLocalFile).toBeCalled();
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][0]).toBe(opts.containerName);
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][1]).toBe('path/in/cdn/dist/file1.js');
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][2]).toBe('/project/dist/file1.js');
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][3]).toEqual({
            contentSettings: {
                cacheControl: 'public, max-age=31556926',
                contentType: 'application/javascript'
            }
        });
        expect(fs.unlinkSync).toBeCalledWith('/project/dist/file1.js.zip');
    });

    it('should gzip files and if size of zipped file is smaller it should upload the gzip file, if zip option is true', function () {
        jest.mock('azure-storage');
        jest.mock('zlib');
        jest.mock('fs');
        var fs = require('fs');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var zlib = require('zlib');
        var files = [
            {cwd: '/project', path: '/project/dist/file1.js'}
        ];
        var logger = jest.fn();
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: 'path/in/cdn', // path within container
            deleteExistingBlobs: false, // true means recursively deleting anything under folder
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            zip: true, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        zlib.createGzip = jest.fn().mockReturnValue({on: jest.fn()});
        azure.createBlobService().createBlockBlobFromLocalFile.mockClear();
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback();
        });
        azure.createBlobService().createBlockBlobFromLocalFile.mockImplementation(function (param1, param2, param3, param4, callback) {
            callback();
        });
        fs.createReadStream = jest.fn().mockReturnValue({
            pipe: jest.fn().mockReturnThis()
        });
        fs.createWriteStream = jest.fn().mockReturnValue({
            on: function(event, cb){
                if(event === 'close'){
                    cb();
                }
            },
            pipe: jest.fn().mockReturnThis()
        });
        fs.stat = jest.fn().mockImplementation(function(file, callback){
            if(file === '/project/dist/file1.js'){
                callback(null, {size: 101});
            }
            if(file === '/project/dist/file1.js.zip'){
                callback(null, {size: 100});
            }
        });
        fs.unlinkSync = jest.fn();

        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(zlib.createGzip).toBeCalled();
        expect(azure.createBlobService().createBlockBlobFromLocalFile).toBeCalled();
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][0]).toBe(opts.containerName);
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][1]).toBe('path/in/cdn/dist/file1.js');
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][2]).toBe('/project/dist/file1.js.zip');
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][3]).toEqual({
            contentSettings: {
                cacheControl: 'public, max-age=31556926',
                contentType: 'application/javascript',
                contentEncoding: 'gzip'
            }
        });
        expect(fs.unlinkSync).toBeCalledWith('/project/dist/file1.js.zip');
    });


});
