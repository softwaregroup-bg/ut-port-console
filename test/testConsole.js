require('repl').start({useGlobal: true});

var wire = require('wire');

m = wire({
    host: '0.0.0.0',
    port: 30001,
    winston : {
        create : {
            module  : 'ut-log',
            args    : {
                type : 'winston',
                name : 'console_test',
                transports : {
                    'console' : {
                        colorize: 'true',
                        level: 'trace'
                    },
                    'webhook' : {
                        host: {$ref: 'host'},
                        port: {$ref: 'port'},
                        level: 'trace'
                    }
                }
            }
        }
    },
    console: {
        create: 'ut-port-console',
        init: 'init',
        properties: {
            config: {
                host: {$ref: 'host'},
                port: {$ref: 'port'}
            }
        },
        ready:'start'
    }
}, {require: require})
.then(function contextLoaded(context) {
    log = context.winston;
})
.otherwise(function(error) {
    err = error;
});

