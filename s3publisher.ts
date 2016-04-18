///<reference path="typings/main.d.ts"/>
var AWS = require('aws-sdk');
import when = require('when');
import nodefn = require('when/node');
var guard = require('when/guard');
import Debug = require('debug');
var debug = Debug('s3publisher');
import util = require('./util');
import Publisher = require('./publisher');

// S3 doesn't like leading slashes
function normalizePath(p) {
    return p.split('/').filter(function (elt) {
        return elt != '';
    }).join('/');
}

class S3Publisher implements Publisher {
    bucket: string;
    putObject: any;
    deleteObject: any;
    getObject: any;
    headObject: any;
    listObjects: any;

    constructor(config: {region: string, bucket: string}) {
        this.bucket = config.bucket;
        var s3 = new AWS.S3({region: config.region});
        this.putObject = guard(guard.n(1), nodefn.lift(s3.putObject.bind(s3)));
        this.deleteObject = guard(guard.n(1), nodefn.lift(s3.deleteObject.bind(s3)));
        this.getObject = guard(guard.n(10), nodefn.lift(s3.getObject.bind(s3)));
        this.headObject = guard(guard.n(1), nodefn.lift(s3.headObject.bind(s3)));
        this.listObjects = guard(guard.n(1), nodefn.lift(s3.listObjects.bind(s3)));
    }

    put(path, obj, contentType): Promise<void> {
        debug('put ' + path);
        var params = {
            Bucket: this.bucket,
            Key: normalizePath(path),
            Body: obj,
            ContentType: contentType !== undefined ? contentType : util.inferMimetype(path)
        };
        return this.putObject(params).
            then(function () {
                // S3 doesn't infer '.html' on filenames,
                // so we have to put both 'path' and 'path.html'
                if (params.ContentType === 'text/html' && !/\.html$/.test(params.Key)) {
                    params.Key = params.Key + '.html';
                    return this.putObject(params);
                }
            });
    }
    
    delete(path, contentType): Promise<void> {
        debug('delete ' + path);
        return this.deleteObject({Bucket: this.bucket, Key: path}).
            then(() => {
                if (contentType == 'text/html' && !/\.html$/.test(path))
                    return this.deleteObject({Bucket: this.bucket, Key: path + '.html'});
            }).
            then(() => null);
    }

    get(path): Promise<{Body: Buffer, ContentType: string}> {
        debug('get ' + path);
        return this.getObject({Bucket: this.bucket, Key: normalizePath(path)});
    }

    exists(path): Promise<boolean> {
        debug('exists ' + path);
        return this.headObject({Bucket: this.bucket, Key: normalizePath(path)}).
            then(function () {
                return true;
            }).
            catch(function () {
                return false;
            });
    }

    async list(): Promise<string[]> {
        debug('list');
        // FIXME: handle truncated results
        var data = await this.listObjects({Bucket: this.bucket});
        return data.Contents.map(o => o.Key);
    }

    rollback(): Promise<void> {
        // NOOP
        return Promise.resolve(null);
    }

    commit(msg): Promise<void> {
        return this.exists('log.txt').
            then(exists => exists ? this.get('log.txt').then(obj => obj.Body.toString()) : '').
            then(text => {
                var log = text + new Date().toLocaleString() + ' ' + msg + '\n';
                return this.put('log.txt', log, 'text/plain');
            }).
            then(() => null);
    }
}

export = S3Publisher;