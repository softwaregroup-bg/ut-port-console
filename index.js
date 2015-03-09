(function(define) {define(function(require) {
    //dependencies
    var Port = require('ut-bus/port');
    var Path = require('path');
    var util = require('util');
    var io = require('socket.io');
    var Hapi = require('hapi');
    var JSONStream = require('JSONStream');
    var _undefined;

    function Console() {
        Port.apply(this, arguments);
        this.config = {
            id: 'debug_console',
            host: '127.0.0.1',
            port: 30001
        };
        this.db = null;
        this.httpServer = null;
        this.socket = null;
        this.console = null;
    }

    util.inherits(Console, Port);

    Console.prototype.init = function ConsoleInit() {
        Port.prototype.init.apply(this, arguments);
    };

    Console.prototype.readFromDB = function readFromDB(criteria) {
        if (!this.db) {
            return;
        }
        var self = this;
        this.db.createValueStream({
            gte : criteria.from + '0000',
            lte : criteria.to + '9999'
        }).on('data', function(log) {
            log = JSON.parse(log);
            self.console.emit(log.timestamp ? 'logMessage' : 'logJSON', log);
        });
    };
    // temp solution above

    Console.prototype.start = function ConsoleStart() {
        Port.prototype.start.apply(this, arguments);
        var self = this;
        this.httpServer = new Hapi.Server();
        this.httpServer.connection({
            host : this.config.host,
            port : this.config.port
        });
        this.httpServer.route({
            method: 'GET',
            path: '/{p*}',
            handler: {
                directory: {
                    path: Path.join(__dirname, 'public'),
                    listing: false,
                    index: true
                }
            }
        });
        this.httpServer.route({
            method: 'POST',
            path:'/winston-log',
            handler: function(request, reply) {
                self.console.emit('logMessage', request.payload.params);
                return reply('');
            }
        });
        this.httpServer.route({
            method: 'POST',
            path:'/upload-logs',
            config: {
                payload : {
                    maxBytes: 209715200,
                    output:'stream',
                    parse: true
                },
                handler: function(request, reply) {
                    request.payload.files.pipe(JSONStream.parse('*')).on('data', function(log) {
                        self.console.emit(log.timestamp ? 'logMessage' : 'logJSON', log);
                    });
                    return reply('');
                }
            }
        });
        this.httpServer.route({
            method: 'POST',
            path:'/query-logs',
            handler: function(request, reply) {
                self.readFromDB(request.payload);
                return reply('');
            }
        });
        this.socket = io(this.httpServer.listener);
        this.socket.of('/log').on('connection', function(socket) {
            socket.on('log', function(msg) {
                self.console.emit('logJSON', msg);
            });
        });
        this.console = this.socket.of('/console');
        this.httpServer.start(function(){
            console.log('go to: ' + self.httpServer.info.uri + ' to access the debug console');
        });
    };

    Console.prototype.stop = function ConsoleStop() {
        Port.prototype.stop.apply(this, arguments);
        // cleanup
        this.socket.end('Console socket closed');
        this.httpServer.stop();
        if (this.db && this.db.close) {
            this.db.close();
            this.db = _undefined;
        }
        this.httpServer = _undefined;
        this.socket = _undefined;
        this.console = _undefined;
    };

    return Console;

});}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));
