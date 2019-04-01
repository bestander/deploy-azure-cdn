"use strict";

var mocks = {
    createContainerIfNotExists: jest.fn(),
    listBlobsSegmentedWithPrefix: jest.fn(),
    deleteBlob: jest.fn(),
    createBlockBlobFromLocalFile: jest.fn(),
    withFilter: jest.fn(),
};

module.exports = {
    createBlobService: function () {
        return mocks;
    },
    ExponentialRetryPolicyFilter: jest.fn().mockImplementation(() => {return jest.fn()})
};
