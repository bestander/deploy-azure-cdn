# deploy-azure-cdn

A node package for copying a directory to Azure CDN storage.
Also it provides a gulp plugin interface for easy deploy with [gulp](http://gulpjs.com/)

Azure SDK uses by default the environment variables AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_ACCESS_KEY.
Custom connection arguments can be set in options.

## Installing

```
npm install deploy-azure-cdn
```

## Exported interface

- gulpPlugin: function(deployOptions) - to use with gulp
- vanilla: function(deployOptions, files, logger, cb) - to use directly in node.js

parameters:
- deployOptions - azure cdn and upload configs
  - serviceOptions: [] - custom arguments to azure.createBlobService
  - containerName: null -  container name, required
  - containerOptions: {publicAccessLevel: "blob"} - container options
  - folder: '', // path within container. Default is root directory of container
  - deleteExistingBlobs: true, // set it to false to skip recursive deleting blobs in folder
  - concurrentUploadThreads : 10, // number of concurrent uploads, choose best for your network condition
  - gzip: false, // true if want to gzip the files before uploading. File will be zipped only if compressed file is smaller than original
  - metadata: {cacheControl: 'public, max-age=31556926'} // metadata for each uploaded file
  - testRun: false, // set to true if you just want to check connectivity and see deployment logs. No blobs will be removed or uplaoded.
- files: [] - array of files objects to be deployed
  - cwd - current working directory path
  - path - absolute path of file
- logger - logger compatible with gutil.log(param1, param2...)
- cb - node callback


## Using in Gulp example
```javascript
var deployCdn = require('gulp-deploy-azure-cdn');

gulp.task('upload-app-to-azure', function () {
    return gulp.src(['build/**/*'], {
        cwd: 'build'
    }).pipe(deployCdn.gulpPlugin({
        containerName: 'test',
        serviceOptions: ['<my azure cdn name>', '<my azure cdn secret>'],
        folder:  'build-0.0.1/',
        gzip: true,
        deleteExistingBlobs: true,
        metadata: {
            cacheControl: 'public, max-age=31530000', // cache in browser
            cacheControlHeader: 'public, max-age=31530000' // cache in azure CDN. As this data does not change, we set it to 1 year
        }
    }))
});

```

## Grunt plugin
See my other repository: https://github.com/bestander/grunt-azure-cdn-deploy.
Code is very similar but less structured.
