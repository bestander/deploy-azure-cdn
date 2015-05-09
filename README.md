# deploy-azure-cdn
[![Build Status](https://travis-ci.org/bestander/deploy-azure-cdn.svg?branch=master)](https://travis-ci.org/bestander/deploy-azure-cdn)

A node package for uploading files to Azure Blob Storage.
It is perfect for deploying compiled assets to Microsoft Azure CDN as a last step in a Continuous Integration setup.

## Features

- Ability to execute a "dry run" of deployment. The logging will indicate all files that will be deleted or uploaded but no actual changes to the blob storage will be done
- Ability to gzip content and set a proper content encoding. If gzipped file becomes larger than original then only the original file will be uploaded
- Ability to recursively remove files in a path of Azure Blob Storage
- Ability to control number of concurrent files to be uploaded to avoid network congestion
- [Grunt](https://github.com/bestander/grunt-azure-cdn-deploy) and [gulp](https://github.com/bestander/gulp-deploy-azure-cdn) plugins available

## Installing

```
npm install deploy-azure-cdn
```

## Using

See `__tests__` folder for all possible scenarios.

### Deploying a set of files to a path in blob storage

```javascript
var logger = console.log;
var files = [
    {cwd: 'node_modules/deploy-azure-cdn', path: '/Users/bestander/work/opensource/gulp-deploy-azure-cdn/node_modules/deploy-azure-cdn/index.js'},
    {cwd: 'node_modules/deploy-azure-cdn', path: '/Users/bestander/work/opensource/gulp-deploy-azure-cdn/node_modules/deploy-azure-cdn/LICENSE'},
    {cwd: 'node_modules/deploy-azure-cdn', path: '/Users/bestander/work/opensource/gulp-deploy-azure-cdn/node_modules/deploy-azure-cdn/package.json'}
];
var opts = {
    serviceOptions: ['blobstoragename', '/OwQ/MyLongSecretStringFromAzureConfigPanel'], // custom arguments to azure.createBlobService
    containerName: 'test', // container name in blob
    containerOptions: {publicAccessLevel: "blob"}, // container options
    folder: 'deploy/source', // path within container
    deleteExistingBlobs: true, // true means recursively deleting anything under folder
    concurrentUploadThreads: 2, // number of concurrent uploads, choose best for your network condition
    zip: true, // gzip files if they become smaller after zipping, content-encoding header will change if file is zipped
    metadata: {cacheControl: 'public, max-age=31556926'}, // metadata for each uploaded file
    testRun: false // test run - means no blobs will be actually deleted or uploaded, see log messages for details
};
deploy(opts, files, logger, function(err){
    if(err) {
        console.log("Error deploying", err)
    }
    console.log('Job\'s done!');
});
```

### Parameters
- `deployOptions` - azure cdn and upload configs
  - `serviceOptions`: [] - custom arguments to azure.createBlobService, or you can use Azure SDK environment variables AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY
  - `containerName`: null -  container name, required
  - `containerOptions`: {publicAccessLevel: "blob"} - container options
  - `folder`: '', // path within container. Default is root directory of container
  - `deleteExistingBlobs`: true, // set it to false to skip recursive deleting blobs in folder
  - `concurrentUploadThreads` : 10, // number of concurrent uploads, choose best for your network condition
  - `zip`: false, // true if want to gzip the files before uploading. File will be zipped only if compressed file is smaller than original
  - `metadata`: {cacheControl: 'public, max-age=31556926'} // metadata for each uploaded file
  - `testRun`: false, // set to true if you just want to check connectivity and see deployment logs. No blobs will be removed or uplaoded.
- `files`: [] - array of files objects to be deployed
  - `path` - absolute path of file
  - `cwd` - [deprecated] current working directory path. Now replaced by `base`
  - `base` - (optional) the base directory in which the file is located. The relative path of file to this directory is used as the destination path  
    *Note*: if both `base` and `cwd` are missing, the file will be uploaded to the root of the CDN `folder`.
  - `dest` - (optional) if provided, file will be uploaded to this path on CDN. (relative to the `folder`). Useful for cases where you want to upload to a different path or file name.
- `logger` - logger compatible with console.log(param1, param2...)
- `cb` - node callback

## Grunt and gulp plugins
See plugins as repositories:
- [https://github.com/bestander/grunt-azure-cdn-deploy](https://github.com/bestander/grunt-azure-cdn-deploy)
- [https://github.com/bestander/gulp-deploy-azure-cdn](https://github.com/bestander/gulp-deploy-azure-cdn)

## TODO, contributions are welcome

- use streams to upload encoded files
