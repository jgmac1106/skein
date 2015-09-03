///<reference path="typings/tsd.d.ts"/>
import when = require('when');

interface Domain {
    put(path: string, obj: any, contentType: string): void;
    get(path: string): when.Promise<Buffer>;
    exists(path: string): when.Promise<boolean>;
    list(): when.Promise<string[]>;
}

export = Domain;