const Path = require('path');
const Hapi = require('hapi');
const Inert = require('inert');
const UtWss = require('ut-wss');
const jwt = require('jsonwebtoken');
const Boom = require('boom');
const dgram = require('dgram');
var split2 = require('split2');
const _undefined = undefined;
const cache = require('lru-cache');

module.exports = function({utPort}) {
    return class ConsolePort extends utPort {
        constructor() {
            super(...arguments);
            this.db = null;
            this.httpServer = null;
            this.socket = null;
            this.utWss = null;
            this.console = null;
            this.wsConsole = null;
            this.queue = [];
            this.browserConnected = false;
        }
        get defaults() {
            return {
                id: 'utPortConsole',
                type: 'console',
                exclusive: true,
                host: 'localhost',
                port: 30001,
                server: {
                    address: 'localhost',
                    port: 30001,
                    state: {
                        strictHeader: false
                    }
                },
                cookie: {
                    ttl: 100 * 60 * 1000,
                    encoding: 'none',
                    isSecure: true,
                    isHttpOnly: true,
                    clearInvalid: false,
                    strictHeader: true
                },
                ssoAuthUrl: 'not configured',
                jwt: {
                    cookieKey: 'ut5-cookie',
                    key: 'ut5-secret',
                    verifyOptions: {
                        ignoreExpiration: true,
                        algorithms: ['HS256']
                    },
                    signOptions: {
                        expiresIn: '1h',
                        algorithm: 'HS256'
                    }
                },
                cache: {
                    max: 100,
                    maxAge: 60 * 1000
                },
                maxLength: 16 * 1024
            };
        }
        async init() {
            const result = await super.init(...arguments);
            this.config.k8s = {
                ports: [{
                    name: 'http-ui',
                    service: {
                        clusterIP: 'None'
                    },
                    ingress: {
                        host: this.config.server.host
                    },
                    containerPort: this.config.server.port
                }, {
                    name: 'udp-log',
                    protocol: 'UDP',
                    service: {
                        clusterIP: 'None'
                    },
                    containerPort: this.config.port
                }]
            };
            return result;
        }
        readFromDB(criteria) {
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
                self.emit('logJSON', log);
            }).on('end', function() {
                // self.console.emit('spinStop', '');
            });
        }
        emit(type, msg) {
            if (this.browserConnected) {
                this.queue.push({type, msg});
                while (this.queue.length) {
                    this.utWss.publish({path: '/status'}, JSON.stringify(this.queue.shift()));
                }
            } else {
                if (this.queue.length >= 100) {
                    this.queue.shift();
                }
                this.queue.push({type, msg});
            }
        }
        async start() {
            await super.start(...arguments);
            var self = this;
            this.httpServer = new Hapi.Server(this.config.server);
            await this.httpServer.register(Inert);
            this.httpServer.route({
                method: 'GET',
                path: '/healthz',
                options: {
                    auth: false,
                    handler: (request, h) => ((this.isReady && 'ok') || h.response('service not available').code(503))
                }
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
                method: 'GET',
                path: '/sso/client',
                config: {auth: false},
                handler: {
                    file: Path.join(__dirname, 'public', 'sso.html')
                }
            });
            this.httpServer.route({
                method: 'GET',
                path: '/js/config.js',
                config: {auth: false},
                handler: (req, h) => {
                    var config = {
                        ssoAuthUrl: this.config.ssoAuthUrl,
                        xsrfToken: (req.state && req.state['xsrf-token'])
                    };
                    return h.response(`var config = ${JSON.stringify(config)}`);
                }
            });
            this.httpServer.route({
                method: 'POST',
                path: '/sso/client',
                config: {auth: false},
                handler: (req, reply) => {
                    var cookieConf = Object.assign({}, this.config.cookie, {path: '/'});
                    if (req.payload && req.payload.cookie && req.payload.cookie.name && req.payload.cookie.value) {
                        jwt.verify(req.payload.cookie.value, this.config.jwt.key, Object.assign({}, this.config.jwt.verifyOptions, {ignoreExpiration: false}), (err, decoded) => {
                            if (err) {
                                reply(Boom.unauthorized());
                            } else {
                                reply('OK')
                                    .state(
                                        req.payload.cookie.name,
                                        req.payload.cookie.value,
                                        cookieConf
                                    )
                                    .state(
                                        'xsrf-token',
                                        decoded.xsrfToken,
                                        cookieConf
                                    );
                            }
                        });
                    } else {
                        reply(Boom.unauthorized());
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
                        request.payload.files.pipe(split2(JSON.parse)).on('data', function(log) {
                            self.emit('logJSON', log);
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

            this.cache = cache(this.config.cache);

            let logError = (error, data) => this.emit('logJSON', {
                error: {
                    message: error.message,
                    type: 'split2.error'
                },
                name: this.config.id,
                context: 'console port',
                service: this.bus.config.service,
                level: 'error',
                $meta: {
                    mtid: 'error',
                    method: 'split2.write'
                },
                msg: data && data.substr && data.substr(0, 256)
            });

            let createStream = (id, rinfo) => {
                let result = split2(/\n/, JSON.parse, {maxLength: this.config.maxLength});
                this.cache.set(id, result);
                result.on('data', msg => this.emit('logJSON', msg));
                result.mapper = msg => {
                    try {
                        return JSON.parse(msg);
                    } catch (error) {
                        logError(error, msg);
                        result.destroy();
                        return null;
                    }
                };
                result.on('error', error => {
                    logError(error, result._last);
                    result.destroy();
                });
                result.on('close', () => {
                    this.cache.del(id);
                    this.socket.send(JSON.stringify({method: 'uuid'}), rinfo.port, rinfo.address); // notify sender to generate new stream id
                });
                return result;
            };
            this.socket = dgram.createSocket('udp4');
            this.socket.on('message', (msg, rinfo) => {
                let id = msg.slice(0, 16).toString('hex');
                let stream = this.cache.get(id) || createStream(id, rinfo);
                stream.write(msg.slice(16));
            });
            this.socket.on('close', () => {
                this.cache.reset();
            });
            this.socket.bind({
                address: this.config.address,
                port: this.config.port,
                exclusive: this.config.exclusive
            });

            this.utWss = new UtWss({log: this.log}, this.config);
            this.utWss.on('connection', () => {
                self.browserConnected = true;
                self.emit('logJSON', '');
            });
            this.utWss.registerPath('/status');
            this.utWss.start(this.httpServer.listener);

            this.httpServer.start(function() {
                self.log.info && self.log.info({
                    $meta: {
                        mtid: 'event',
                        opcode: `port.started`
                    },
                    msg: 'go to: ' + self.httpServer.info.uri + ' to access the debug console'
                });
            });
        }
        async stop() {
            // cleanup
            this.socket.close();
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
            return super.stop(...arguments);
        }
    };
};
