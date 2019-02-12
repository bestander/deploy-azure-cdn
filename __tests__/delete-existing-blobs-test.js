"use strict";
// otherwise it starts mocking all node packages
jest.autoMockOff();
jest.useFakeTimers();

describe('Azure Deploy Task', function () {

    it('should not delete any blobs if deleteExistingBlobs is false', function () {
        jest.mock('azure-storage');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var files = [];
        var logger = {};
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: '', // path within container
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
        expect(azure.createBlobService().listBlobsSegmentedWithPrefix).not.toBeCalled();
        expect(azure.createBlobService().deleteBlob).not.toBeCalled();
    });

    it('should list the blobs with logger service but not delete them if testRun option is true', function () {
        jest.mock('azure-storage');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var files = [];
        var logger = jest.fn();
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: '/path/in/cdn', // path within container
            deleteExistingBlobs: true, // true means recursively deleting anything under folder
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: true // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback();
        });
        azure.createBlobService().listBlobsSegmentedWithPrefix.mockImplementation(function (param1, param2, param3, callback) {
            callback(null, {
                entries: [
                    {name: "file1"},
                    {name: "file2"}
                ]
            });
        });
        azure.createBlobService().deleteBlob.mockImplementation(function (param1, param2, callback) {
            callback(null);
        });
        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(azure.createBlobService().listBlobsSegmentedWithPrefix.mock.calls[0][0]).toEqual(opts.containerName);
        expect(azure.createBlobService().listBlobsSegmentedWithPrefix.mock.calls[0][1]).toEqual(opts.folder);
        expect(logger).toBeCalledWith("deleting file", "file1");
        expect(logger).toBeCalledWith("deleting file", "file2");
        // test run shows the log but never calls azure api
        expect(azure.createBlobService().deleteBlob).not.toBeCalled();
        expect(logger).toBeCalledWith("deleted", "file1");
        expect(logger).toBeCalledWith("deleted", "file2");
    });

    it('should delete all blobs returned from azure.listBlobsSegmentedWithPrefix and call logger after deletion', function () {
        jest.mock('azure-storage');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var files = [];
        var logger = jest.fn();
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: '/path/in/cdn', // path within container
            deleteExistingBlobs: true, // true means recursively deleting anything under folder
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback();
        });
        azure.createBlobService().listBlobsSegmentedWithPrefix.mockImplementation(function (param1, param2, param3, callback) {
            callback(null, {
                entries: [
                    {name: "file1"},
                    {name: "file2"}
                ]
            });
        });
        azure.createBlobService().deleteBlob.mockImplementation(function (param1, param2, callback) {
            callback(null);
        });
        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(azure.createBlobService().deleteBlob).toBeCalled();
        expect(azure.createBlobService().deleteBlob.mock.calls.length).toEqual(2);
        expect(azure.createBlobService().deleteBlob.mock.calls[0][0]).toEqual(opts.containerName);
        expect(azure.createBlobService().deleteBlob.mock.calls[0][1]).toEqual("file1");
        expect(azure.createBlobService().deleteBlob.mock.calls[1][0]).toEqual(opts.containerName);
        expect(azure.createBlobService().deleteBlob.mock.calls[1][1]).toEqual("file2");
        expect(logger).toBeCalledWith("deleted", "file1");
        expect(logger).toBeCalledWith("deleted", "file2");
    });

    it('should stop execution if listBlobsSegmentedWithPrefix returned error', function () {
        jest.mock('azure-storage');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var files = [];
        var logger = jest.fn();
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: '/path/in/cdn', // path within container
            deleteExistingBlobs: true, // true means recursively deleting anything under folder
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        azure.createBlobService().deleteBlob.mockClear();
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback();
        });
        azure.createBlobService().listBlobsSegmentedWithPrefix.mockImplementation(function (param1, param2, param3, callback) {
            callback("list blob error");
        });
        azure.createBlobService().deleteBlob.mockImplementation(function (param1, param2, callback) {
            callback(null);
        });
        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(azure.createBlobService().deleteBlob).not.toBeCalled();
        expect(cb).toBeCalledWith("list blob error");
        expect(cb.mock.calls.length).toBe(1);
    });

    it('should stop execution if deleteBlob returned error', function () {
        jest.mock('azure-storage');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var files = [
            {cwd: 'app', path: '/dist/file1.js'},
            {cwd: 'app', path: '/dist/file2.js'}
        ];
        var logger = jest.fn();
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: '/path/in/cdn', // path within container
            deleteExistingBlobs: true, // true means recursively deleting anything under folder
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback();
        });
        azure.createBlobService().listBlobsSegmentedWithPrefix.mockImplementation(function (param1, param2, param3, callback) {
            callback(null, {
                entries: [
                    {name: "file1"},
                    {name: "file2"}
                ]
            });
        });
        azure.createBlobService().deleteBlob.mockImplementation(function (param1, param2, callback) {
            callback("error deleting");
        });
        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(cb).toBeCalledWith("error deleting");
        expect(cb.mock.calls.length).toBe(1);
        expect(azure.createBlobService().createBlockBlobFromLocalFile).not.toBeCalled();
    });

    it('should clear folder and finish gracefully even if there are no files to upload', function () {
        jest.mock('azure-storage');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var files = [];
        var logger = jest.fn();
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: '/path/in/cdn', // path within container
            deleteExistingBlobs: true, // true means recursively deleting anything under folder
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback();
        });
        azure.createBlobService().listBlobsSegmentedWithPrefix.mockImplementation(function (param1, param2, param3, callback) {
            callback(null, {
                entries: [
                    {name: "file1"},
                    {name: "file2"}
                ]
            });
        });
        azure.createBlobService().deleteBlob.mockImplementation(function (param1, param2, callback) {
            callback(null);
        });
        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(cb).toBeCalledWith(undefined);
        expect(cb.mock.calls.length).toBe(1);
    });

});
