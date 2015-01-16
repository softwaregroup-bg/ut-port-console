require('repl').start({useGlobal: true});

var wire = require('wire');

m = wire({
    host: '127.0.0.1',
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
    log1 = context.winston.createLog('trace', {name: 'log1_name', context: 'log1_context'});
    log2 = context.winston.createLog('trace', {name: 'log2_name', context: 'log2_context'});
    log3 = context.winston.createLog('trace', {name: 'log3_name', context: 'log3_context'});
})
.otherwise(function(error) {
    err = error;
});
