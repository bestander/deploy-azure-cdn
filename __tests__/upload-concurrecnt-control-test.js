"use strict";
// otherwise it starts mocking all node packages
jest.autoMockOff();
jest.useFakeTimers();

describe('Azure Deploy Task', function () {

    it('should upload concurrently not more than set in concurrentUploadThreads', function () {
        jest.mock('azure-storage');
        jest.mock('zlib');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var zlib = require('zlib');
        var files = [
            {base: '/project', path: '/project/dist/file1.js'},
            {base: '/project', path: '/project/dist/file2.js'},
            {base: '/project', path: '/project/dist/file3.js'},
            {base: '/project', path: '/project/dist/file4.js'}
        ];
        var logger = jest.fn();
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: 'path/in/cdn', // path within container
            deleteExistingBlobs: false, // true means recursively deleting anything under folder
            concurrentUploadThreads: 2, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback();
        });
        var uploadCallbacks = [];
        azure.createBlobService().createBlockBlobFromLocalFile.mockImplementation(function (param1, param2, param3, param4, callback) {
            uploadCallbacks.push(callback);
        });
        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls.length).toBe(2);
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[0][2]).toBe('/project/dist/file1.js');
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[1][2]).toBe('/project/dist/file2.js');
        uploadCallbacks.forEach(function(cb){
            cb();
        });
        jest.runAllTimers();
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls.length).toBe(4);
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[2][2]).toBe('/project/dist/file3.js');
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls[3][2]).toBe('/project/dist/file4.js');
        uploadCallbacks.forEach(function(cb){
            cb();
        });
        jest.runAllTimers();
        expect(cb).toBeCalledWith(null);
    });

    it('should exit with error if one of the uploads fails', function () {
        jest.mock('azure-storage');
        jest.mock('zlib');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var zlib = require('zlib');
        var files = [
            {base: '/project', path: '/project/dist/file1.js'},
            {base: '/project', path: '/project/dist/file2.js'},
            {base: '/project', path: '/project/dist/file3.js'},
            {base: '/project', path: '/project/dist/file4.js'}
        ];
        var logger = jest.fn();
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: 'path/in/cdn', // path within container
            deleteExistingBlobs: false, // true means recursively deleting anything under folder
            concurrentUploadThreads: 4, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        azure.createBlobService().createBlockBlobFromLocalFile.mockReset();
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback();
        });
        var uploadCallbacks = [];
        azure.createBlobService().createBlockBlobFromLocalFile.mockImplementation(function (param1, param2, param3, param4, callback) {
            if(param3 === '/project/dist/file3.js') {
                callback('Error uploading file 3');
            } else {
                callback();
            }
        });
        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(azure.createBlobService().createBlockBlobFromLocalFile.mock.calls.length).toBe(4);
        expect(cb).toBeCalledWith('Error uploading file 3');
    });

    it('should list the uploaded files with logger service but should not make the actual upload if testRun is true', function () {
        jest.mock('azure-storage');
        jest.mock('zlib');
        var deploy = require('../src/deploy-task');
        var azure = require('azure-storage');
        var zlib = require('zlib');
        var files = [
            {base: '/project', path: '/project/dist/file1.js'},
            {base: '/project', path: '/project/dist/file2.js'},
            {base: '/project', path: '/project/dist/file3.js'},
            {base: '/project', path: '/project/dist/file4.js'}
        ];
        var logger = jest.fn();
        var cb = jest.fn();
        var opts = {
            serviceOptions: [], // custom arguments to azure.createBlobService
            containerName: 'testContainer', // container name, required
            containerOptions: {publicAccessLevel: "blob"}, // container options
            folder: 'path/in/cdn', // path within container
            deleteExistingBlobs: false, // true means recursively deleting anything under folder
            concurrentUploadThreads: 4, // number of concurrent uploads, choose best for your network condition
            zip: false, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
            metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
            testRun: true // test run - means no blobs will be actually deleted or uploaded, see log messages for details
        };
        azure.createBlobService().createBlockBlobFromLocalFile.mockReset();
        azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
            callback();
        });
        azure.createBlobService().createBlockBlobFromLocalFile.mockImplementation(function (param1, param2, param3, param4, callback) {
            callback();
        });
        deploy(opts, files, logger, cb);
        jest.runAllTimers();
        expect(azure.createBlobService().createBlockBlobFromLocalFile).not.toBeCalled();
        expect(logger).toBeCalledWith("Uploading", "path/in/cdn/dist/file1.js", "encoding", undefined);
        expect(logger).toBeCalledWith("Uploaded", "path/in/cdn/dist/file1.js", "to", "testContainer");
        expect(logger).toBeCalledWith("Uploading", "path/in/cdn/dist/file2.js", "encoding", undefined);
        expect(logger).toBeCalledWith("Uploaded", "path/in/cdn/dist/file2.js", "to", "testContainer");
        expect(logger).toBeCalledWith("Uploading", "path/in/cdn/dist/file3.js", "encoding", undefined);
        expect(logger).toBeCalledWith("Uploaded", "path/in/cdn/dist/file3.js", "to", "testContainer");
        expect(logger).toBeCalledWith("Uploading", "path/in/cdn/dist/file4.js", "encoding", undefined);
        expect(logger).toBeCalledWith("Uploaded", "path/in/cdn/dist/file4.js", "to", "testContainer");
        expect(cb).toBeCalledWith(null);
    });

    it('should use cwd of a file if base missing and should warn about deprecation', function () {
      jest.mock('azure-storage');
      jest.mock('zlib');
      var deploy = require('../src/deploy-task');
      var azure = require('azure-storage');
      var files = [
          { cwd: '/project', path: '/project/dist/file1.js' },
      ];
      var logger = jest.fn();
      var cb = jest.fn();
      var opts = {
          containerName: 'testContainer',
          folder: 'path/in/cdn',
          deleteExistingBlobs: false
      };
      azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
          callback();
      });
      azure.createBlobService().createBlockBlobFromLocalFile.mockImplementation(function (param1, param2, param3, param4, callback) {
          callback();
      });
      deploy(opts, files, logger, cb);
      jest.runAllTimers();
      expect(logger).toBeCalledWith('[WARNING] `cwd` is deprecated. please use `base` in your files');
      expect(logger).toBeCalledWith("Uploading", "path/in/cdn/dist/file1.js", "encoding", undefined);
      expect(logger).toBeCalledWith("Uploaded", "path/in/cdn/dist/file1.js", "to", "testContainer");
    });

    it('should use filename if no base provided', function () {
      jest.mock('azure-storage');
      jest.mock('zlib');
      var deploy = require('../src/deploy-task');
      var azure = require('azure-storage');
      var files = [
          { path: '/project/dist/file1.js' },
      ];
      var logger = jest.fn();
      var cb = jest.fn();
      var opts = {
          containerName: 'testContainer',
          folder: 'path/in/cdn',
          deleteExistingBlobs: false
      };
      azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
          callback();
      });
      azure.createBlobService().createBlockBlobFromLocalFile.mockImplementation(function (param1, param2, param3, param4, callback) {
          callback();
      });
      deploy(opts, files, logger, cb);
      jest.runAllTimers();
      expect(logger).toBeCalledWith("Uploading", "path/in/cdn/file1.js", "encoding", undefined);
      expect(logger).toBeCalledWith("Uploaded", "path/in/cdn/file1.js", "to", "testContainer");
    });

    it('should upload to `dest` if provided', function () {
      jest.mock('azure-storage');
      jest.mock('zlib');
      var deploy = require('../src/deploy-task');
      var azure = require('azure-storage');
      var files = [
          { base: '/project', path: '/project/dist/file1.js', dest: 'path/some-file.js' },
      ];
      var logger = jest.fn();
      var cb = jest.fn();
      var opts = {
          containerName: 'testContainer',
          folder: 'path/in/cdn',
          deleteExistingBlobs: false
      };
      azure.createBlobService().createContainerIfNotExists.mockImplementation(function (param1, param2, callback) {
          callback();
      });
      azure.createBlobService().createBlockBlobFromLocalFile.mockImplementation(function (param1, param2, param3, param4, callback) {
          callback();
      });
      deploy(opts, files, logger, cb);
      jest.runAllTimers();
      expect(logger).toBeCalledWith("Uploading", "path/in/cdn/path/some-file.js", "encoding", undefined);
      expect(logger).toBeCalledWith("Uploaded", "path/in/cdn/path/some-file.js", "to", "testContainer");
    });

});
