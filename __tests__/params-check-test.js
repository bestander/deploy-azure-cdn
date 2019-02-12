"use strict";
// otherwise it starts mocking all node packages
jest.autoMockOff();

describe('Azure Deploy Task', function () {

    it('should stop execution with error callback if container name is not provided', function () {
        var deploy = require('../src/deploy-task');
        var files = [];
        var logger = {};
        var cb = jest.fn();
        deploy({
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: '', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: '', // path within container
            deleteExistingBlobs: true, // true means recursively deleting anything under folder
            concurrentUploadThreads: 10, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        }, files, logger, cb);
        expect(cb).toBeCalledWith("Missing containerName!");
    });

});
