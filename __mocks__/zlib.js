"use strict";


module.exports = {
    createGzip: jest.genMockFunction().mockReturnValue({
        on: jest.genMockFunction()
    })
};