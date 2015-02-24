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
    log1  = context.winston.createLog('trace', {name: 'log1 name', context: 'log1 context'});
    log2  = context.winston.createLog('trace', {name: 'log2 name', context: 'log2 context'});
    log3  = context.winston.createLog('trace', {name: 'log3 name', context: 'log3 context'});
    log4  = context.winston.createLog('trace', {name: 'log4 name', context: 'log4 context'});
    log5  = context.winston.createLog('trace', {name: 'log5 name', context: 'log5 context'});
    log6  = context.winston.createLog('trace', {name: 'log6 name', context: 'log6 context'});
    log7  = context.winston.createLog('trace', {name: 'log7 name', context: 'log7 context'});
    log8  = context.winston.createLog('trace', {name: 'log8 name', context: 'log8 context'});
    log9  = context.winston.createLog('trace', {name: 'log9 name', context: 'log9 context'});
    log10 = context.winston.createLog('trace', {name: 'log10 name', context: 'log10 context'});
})
.otherwise(function(error) {
    err = error;
});
