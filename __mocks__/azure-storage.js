"use strict";

var mocks = {
    createContainerIfNotExists: jest.genMockFunction(),
    listBlobsSegmentedWithPrefix: jest.genMockFunction(),
    deleteBlob: jest.genMockFunction(),
    createBlockBlobFromLocalFile: jest.genMockFunction()
};

module.exports = {
    createBlobService: function () {
        return mocks;
    }
};