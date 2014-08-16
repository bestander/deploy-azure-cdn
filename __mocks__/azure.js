"use strict";

var mocks = {
    createContainerIfNotExists: jest.genMockFunction(),
    listBlobs: jest.genMockFunction(),
    deleteBlob: jest.genMockFunction(),
    createBlockBlobFromFile: jest.genMockFunction()
};

module.exports = {
    createBlobService: function () {
        return mocks;
    }
};