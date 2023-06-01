const WebSocket = require('ws');
function log({opcode, message, timeout = 500, error}) {
    return [
        {
            name: opcode + ' log message sent',
            method: 'log.' + opcode,
            params: message,
            result(result, assert) {
                assert.equal(result, null, opcode + ' message sent');
            }
        },
        {
            name: opcode + ' log message received',
            params: async() => new Promise(resolve => setTimeout(resolve, timeout)),
            result(result, assert) {
                if (error) {
                    if (this.error) {
                        assert.comment(this.error);
                        assert.ok(this.error, 'expected errors received');
                    } else {
                        assert.fail('expected errors not received');
                    }
                } else if (this[opcode]) {
                    assert.comment(this[opcode]);
                    assert.ok(this[opcode], opcode + 'message received');
                } else {
                    assert.fail(this.error || 'expected errors not received');
                }
            }
        }
    ];
}
require('ut-run').run({
    main: [() => ({
        test: () => [
            require('..'),
            ({utPort}) => class log extends utPort {
                start() {
                    this.pull(this.log.warn);
                    return super.start(...arguments);
                }
            }
        ]
    })],
    method: 'unit',
    config: {
        test: true,
        utLog: {
            streams: {
                stdOut: {
                    level: 'error'
                }
            }
        },
        ConsolePort: {
            disableXsrf: {
                ws: true
            },
            disablePermissionVerify: {
                ws: true
            },
            maxLength: 512,
            errorMessageLength: 1000
        }
    },
    params: {
        steps: [
            {
                name: 'ws',
                async params(context) {
                    const ws = new WebSocket('ws://localhost:30001/status?xsrf=');
                    return new Promise(resolve => ws.on('open', () => resolve(ws)));
                },
                result(ws, assert) {
                    ws.on('message', data => {
                        const {msg} = JSON.parse(data);
                        if (!msg.opcode) {
                            if (msg.error) {
                                if (!this.error) this.error = [];
                                this.error.push(msg);
                            }
                            return;
                        }
                        this[msg.opcode] = data;
                    });
                    assert.ok(ws.url, 'ws connected');
                }
            },
            ...log({
                opcode: 'small',
                message: {text: 'short'}
            }),
            ...log({
                opcode: 'big',
                message: {text: 'long'.repeat(512)},
                error: true
            })
        ]
    }
});
