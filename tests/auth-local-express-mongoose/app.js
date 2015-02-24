var restberry = require('restberry');
var restberryExpress = require('restberry-express');
var restberryMongoose = require('restberry-mongoose');
var restberryAuth = require('restberry-auth');
var restberryAuthLocal = require('restberry-auth-local');
var testlib = require(process.env.NODE_PATH + '/testlib');


restberry
    .config({
        apiPath: '/api/v1',
        port: process.env.NODE_PORT || 6000,
        verbose: true,
    })
    .use(restberryExpress.use(function(waf) {
        var app = waf.app;
        var express = waf.express;
        app.use(express.cookieParser());
        app.use(express.json());
        app.use(express.urlencoded());
        app.use(express.session({
            secret: 'restberry',
        }));
    }))
    .use(restberryMongoose.use(function(odm) {
        odm.connect('mongodb://localhost/restberry-test');
    }))
    .use(restberryAuth.use(function(auth) {
            var app = restberry.waf.app;
            app.use(auth.passport.initialize());
            app.use(auth.passport.session());
            app.use(app.router);
            app.use(restberry.waf.express.methodOverride());
        })
        .use(restberryAuthLocal.config({
            additionalFields: {
                name: {
                    first: {type: String},
                    last: {type: String},
                },
            },
        }))
    ).listen('RESTBERRY');

restberry.model('User')
    .loginRequired()
    .preSave(function(next) {
        var name = this.get('name');
        if (name.first === undefined)  this.set('name', {first: 'tom'});
        next();
    })
    .routes
        .addCreateRoute({
            isLoginRequired: false,
        })
        .addPartialUpdateRoute()
        .addReadManyRoute({
            actions: {
                me: function(req, res, next) {
                    var User = restberry.auth.getUser();
                    req.user.options().addExpand(User.singularName());
                    req.user.toJSON(next);
                },
            },
        })

restberry.model('Foo')
    .schema({
        user: {type: restberry.odm.ObjectId, ref: 'User'},
        name: {type: String},
    })
    .loginRequired()
    .routes
        .addCreateRoute({
            parentModel: restberry.model('User'),
        })
        .addReadRoute()
        .addReadManyRoute({
            parentModel: restberry.model('User'),
        })

restberry.model('Baz')
    .schema({
        name: {type: String},
        nested: {
            user: {type: restberry.odm.ObjectId, ref: 'User'},
            foos: [{
                type: restberry.odm.ObjectId,
                ref: 'Foo'
            }],
        },
    })
    .loginRequired()
    .isAuthorizedToCreate(function(next) {
        var nested = this.get('nested');
        var user = this.restberry.waf.getUser();
        next(nested && nested.user == user.getId());
    })
    .routes
        .addCreateRoute({
            parentModel: restberry.model('User'),
        })

testlib.enableClearData(restberry);