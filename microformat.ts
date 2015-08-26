///<reference path="typings/tsd.d.ts"/>
var parser = require('microformat-node');
var nodefn = require('when/node');
import util = require('./util');
import url = require('url');

var parseHtml = nodefn.lift(parser.parseHtml);

export function getHEntryWithCard(html: string, url: string) {
    return getHEntry(html, url).
        then(function(entry) {
            if (entry.author != null) {
                return getRepHCard(html, url).
                    then(function(card) {
                        if (card !== null) entry.author = card;
                        return entry;
                    });
            }
            else return entry;
        });
}

export function getHEntry(html: string, url: string) {
    return parseHtml(html, {filters: ['h-entry'], baseUrl: url}).
        then(function(mf) {
            return new Entry(mf.items[0]);
        });
}

export function getRepHCard(html: string, url: string) {
    return parseHtml(html, {filters: ['h-card'], baseUrl: url}).
        then(function(mf) {
            var cards = mf.items.map(function(h) {
                return new Card(h);
            });
            // 1. uid and url match page url
            var match = cards.filter(function(c) {
                return c.url != null &&
                c.uid != null &&
                urlsEqual(c.url, url) &&
                urlsEqual(c.uid, url);
            });
            if (match.length > 0) return match[0];
            // 2. url has rel=me
            if (mf.rels.me != null) {
                var match = cards.filter(function(c) {
                    return mf.rels.me.some(function(r) {
                        return c.url != null &&
                        urlsEqual(c.url, r);
                    });
                });
                if (match.length > 0) return match[0];
            }
            // 3. is only hcard, url matches page url
            if (cards.length === 1) {
                var card = cards[0];
                if (card.url != null &&
                        urlsEqual(card.url, url))
                    return card;
            }
            return null;
        });
}

function urlsEqual(u1, u2) {
    var p1 = url.parse(u1);
    var p2 = url.parse(u2);
    return p1.protocol === p2.protocol &&
        p1.host === p2.host &&
        p1.path === p2.path;
}

function prop(mf, name) {
    if (mf.properties[name] !== undefined)
        return mf.properties[name];
    return [];
}

function children(mf) {
    if (mf.children !== undefined)
        return mf.children;
    return [];
}

export class Entry {
    name: string;
    published: string;
    content: {value: string, html: string};
    photo: string;
    url: string;
    author: Card;
    syndication: string[];
    replyTo: Entry;
    likeOf: Entry;
    repostOf: Entry;
    children: Entry[];

    constructor(mf) {
        this.syndication = [];
        this.children = [];
        if (typeof(mf) === 'string') {
            // stub with only url, ie. from "<a href="..." class="u-in-reply-to">"
            this.url = mf;
        } else if (mf.h !== undefined && mf.h === 'entry') {
            // micropub object
            if (mf.url === undefined)
                throw new Error("url is required");
            this.url = mf.url;
            if (mf.published !== undefined)
                this.published = mf.published;
            else
                this.published = new Date().toISOString();
            if (mf.content === undefined)
                mf.content = '';
            this.content = {
                value: mf.content,
                html: util.autoLink(util.escapeHtml(mf.content))
            };
            if (mf.name !== undefined)
                this.name = mf.name;
            else
                this.name = this.content.value;
        } else if (mf.properties !== undefined) {
            // mf parser output
            this.name = prop(mf, 'name');
            this.published = prop(mf, 'published');
            this.content = prop(mf, 'content');
            this.photo = prop(mf, 'photo');
            this.url = prop(mf, 'url');
            this.author = prop(mf, 'author').
                map(a => new Card(a));
            this.syndication = prop(mf, 'syndication');
            this.replyTo = prop(mf, 'in-reply-to').
                map(r => new Entry(r));
            this.likeOf = prop(mf, 'like-of').
                map(r => new Entry(r));
            this.repostOf = prop(mf, 'repost-of').
                map(r => new Entry(r));
            this.children = children(mf).
                concat(prop(mf, 'comment')).
                map(r => new Entry(r));
        } else {
            // deserialized json
            this.name = mf.name;
            this.published = mf.published;
            this.content = mf.content;
            this.photo = mf.photo;
            this.url = mf.url;
            this.author = mf.author.
                map(function (a) {
                    return new Card(a);
                });
            this.syndication = mf.syndication;
            this.replyTo = mf.replyTo.
                map(function (r) {
                    return new Entry(r);
                });
            this.likeOf = mf.likeOf.
                map(function (r) {
                    return new Entry(r);
                });
            this.repostOf = mf.repostOf.
                map(function (r) {
                    return new Entry(r);
                });
            this.children = mf.children.
                map(function (c) {
                    return new Entry(c);
                });
        }
    }

    references(): string[] {
        return this.replyTo.
            concat(this.repostOf).
            concat(this.likeOf).
            map(function(r) { return r.url; });
    }

    allLinks(): string[] {
        var allLinks = this.references();
        if (this.content != null)
            allLinks = allLinks.concat(util.getLinks(this.content.html));
        return allLinks;

    }

    isReply(): boolean {
        return this.replyTo.length > 0;
    }

    isRepost(): boolean {
        return this.repostOf.length > 0;
    }

    isLike(): boolean {
        return this.likeOf.length > 0;
    }

    isPhoto(): boolean {
        return this.photo.length > 0;
    }

    isReplyTo(url: string): boolean {
        return this.references().indexOf(url) !== -1;
    }

    isArticle(): boolean {
        return !this.isReply() &&
            !this.isRepost() &&
            !this.isLike() &&
            !this.isPhoto() &&
            this.name != null &&
            this.content != null &&
            this.name !== this.content.value;
    }
}

export class Card {
    name: string;
    photo: string;
    url: string;
    uid: string;

    constructor(mf) {
        if (mf.properties !== undefined) {
            // mf parser output
            this.name = prop(mf, 'name');
            this.photo = prop(mf, 'photo');
            this.url = prop(mf, 'url');
            this.uid = prop(mf, 'uid');
        } else {
            // deserialized json
            this.name = mf.name;
            this.photo = mf.photo;
            this.url = mf.url;
            this.uid = mf.uid;
        }
    }
}

