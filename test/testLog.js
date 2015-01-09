require('repl').start({useGlobal: true});

socket = require('socket.io-client')('http://192.168.128.133:30001/log');
socket.on('connect', function(){console.log('connected')});
socket.on('event', function(data){console.log('event',data)});
socket.on('connect_error', function(data){console.log('error',data)});
socket.on('connect_timeout', function(data){console.log('timeout',data)});
socket.on('disconnect', function(){});
