var Port = require('ut-bus/port');
var Path = require('path');
var util = require('util');
var io = require('socket.io');
var Hapi = require('hapi');
var Inert = require('inert');
var JSONStream = require('JSONStream');
var utWss = require('ut-port-httpserver/socketServer')
var ws = require('ws');
var _undefined;

function Console() {
    Port.apply(this, arguments);
    this.config = {
        id: 'debug_console',
        server: {
            host: '127.0.0.1',
            port: 30001,
            state: {
                strictHeader: false
            }
        }
    };
    this.db = null;
    this.httpServer = null;
    this.webSockets = [];
    this.socket = null;
    this.wss = null;
    this.utWss = null;
    this.console = null;
    this.wsConsole = null;
    this.queue = [];
    this.browserConnected = false;
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
    // this.console.emit('spinStart', '');
    this.db.createReadStream({
        keys: false,
        values: true,
        valueEncoding: 'json',
        gte: criteria.from + '0000',
        lte: criteria.to + '9999'
    }).on('data', function(log) {
        // self.console.emit(log.timestamp ? 'logMessage' : 'logJSON', log);
        // self.console.emit('logJSON', log);
        self.wss.send({type: 'logJSON', msg: log});
    }).on('end', function() {
        // self.console.emit('spinStop', '');
    });
};

Console.prototype.start = function ConsoleStart() {
    Port.prototype.start.apply(this, arguments);
    var self = this;
    this.httpServer = new Hapi.Server();
    this.httpServer.register(Inert, function() {});
    this.httpServer.connection(this.config.server);
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
        path: '/upload-logs',
        config: {
            payload: {
                maxBytes: 209715200,
                output: 'stream',
                parse: true
            },
            handler: function(request, reply) {
                request.payload.files.pipe(JSONStream.parse('*')).on('data', function(log) {
                    // self.console.emit(log.timestamp ? 'logMessage' : 'logJSON', log);
                    self.wss.send({type: 'logJSON', msg: log});
                });
                return reply('');
            }
        }
    });
    this.httpServer.route({
        method: 'POST',
        path: '/query-logs',
        handler: function(request, reply) {
            self.readFromDB(request.payload);
            return reply('');
        }
    });

    this.socket = io(this.httpServer.listener);
    this.socket.of('/log').on('connection', function(socket) {
        socket.on('log', function(msg) {
            self.emit('logJSON', msg);
        });
    });

    this.utWss = new utWss({}, {disableXsrf: {ws: true}, disablePermissionVerify: {ws: true}}); // @TODO
    this.utWss.on('connection', () => {
        self.browserConnected = true;
        self.emit('logJSON', '');
    });
    this.utWss.start(this.httpServer.listener);
    this.utWss.registerPath('/status');

    this.httpServer.start(function() {
        self.log.info && self.log.info('go to: ' + self.httpServer.info.uri + ' to access the debug console');
    });
};

Console.prototype.emit = function emit(type, msg) {
    if (this.browserConnected) {
        this.queue.push({type, msg});
        while (this.queue.length) {
            var msg  = this.queue.shift();
            this.utWss.publish({path: '/status'}, JSON.stringify(msg));
        }
    } else {
        if (this.queue.length >= 100) {
            this.queue.shift();
        }
        this.queue.push({type, msg});
    }
};

Console.prototype.stop = function ConsoleStop() {
    Port.prototype.stop.apply(this, arguments);
    // cleanup
    this.socket.close('Console socket closed');
    this.httpServer.stop();
    if (this.db && this.db.close) {
        this.db.close();
        this.db = _undefined;
    }
    this.httpServer = _undefined;
    this.socket = _undefined;
    this.console = _undefined;
    this.queue = _undefined;
    this.browserConnected = _undefined;
};

module.exports = Console;
