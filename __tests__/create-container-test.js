"use strict";
// otherwise it starts mocking all node packages
jest.autoMockOff();
jest.useFakeTimers();

describe('Azure Deploy Task', function () {

    it('should create a new blob container if it does not exist', function () {
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
            deleteExistingBlobs: true, // true means recursively deleting anything under folder
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        deploy(opts, files, logger, cb);
        expect(azure.createBlobService().createContainerIfNotExists).toBeCalled();
        expect(azure.createBlobService().createContainerIfNotExists.mock.calls[0][0]).toEqual(opts.containerName);
        expect(azure.createBlobService().createContainerIfNotExists.mock.calls[0][1]).toEqual(opts.containerOptions);
    });

    it('should stop execution a new blob container can\'t be created by azure', function () {
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
            deleteExistingBlobs: true, // true means recursively deleting anything under folder
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback("Failed creating container");
        });
        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(cb).toBeCalledWith("Failed creating container");
        expect(cb.mock.calls.length).toBe(1);
    });

});
