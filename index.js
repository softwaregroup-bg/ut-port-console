(function(define) {define(function(require) {
    //dependencies
    var Port = require('ut-bus/port');
    var util = require('util');
    var http = require('http');
    var io = require('socket.io');
    var fs = require('fs');

    function Console() {
        Port.call(this);
        this.config = {
            id: 'debug_console',
            host: '127.0.0.1',
            port: 30001
        };
        this.socket = null;
        this.httpServer = null;
    }

    util.inherits(Console, Port);

    Console.prototype.init = function ConsoleInit() {
        Port.prototype.init.call(this);
    };

    Console.prototype.start = function ConsoleStart() {
        Port.prototype.start.call(this);
        var self = this;
        this.httpServer = http.createServer(function(req, res) {
            if (req.method === 'GET') {
                switch (req.url) {
                    case '/css' :
                        fs.readFile(__dirname + '/css/style.css', {encoding: 'utf8'}, function(error, data) {
                            res.writeHead(200, {'Content-Type': 'text/css'});
                            res.write(data);
                            res.end();
                        });
                        break;
                    case '/js' :
                        fs.readFile(__dirname + '/js/script.js', {encoding: 'utf8'}, function(error, data) {
                            res.writeHead(200, {'Content-Type': 'text/javascript'});
                            res.write(data);
                            res.end();
                        });
                        break;
                    default :
                        fs.readFile(__dirname + '/html/index.html', {encoding: 'utf8'}, function(error, data) {
                            res.writeHead(200, {'Content-Type': 'text/html'});
                            res.write(data);
                            res.end();
                        });
                }
            } else {
                var data = '';
                req.on('data', function(chunk) {
                    data += chunk;
                });
                req.on('end', function() {
                    self.socket.emit('logMessage', data);
                    res.end();
                });
            }
        });
        this.httpServer.listen(this.config.port, this.config.host);
        this.socket = io.listen(this.httpServer);
        console.log('go to: http://' + this.config.host + ':' + this.config.port + ' to access the debug console');
    };

    Console.prototype.stop = function ConsoleStop() {
        Port.prototype.stop.call(this);
        this.socket.end('Console socket closed');
        this.httpServer.close();
        // cleanup just in case
        this.socket = null;
        this.httpServer = null;
    };

    return Console;

});}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));
