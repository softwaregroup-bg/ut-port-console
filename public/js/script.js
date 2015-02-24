jQuery(document).ready(function(){
    var socket = io.connect(location.host + '/console');
    socket.on('logMessage', function(data) {
        try {data.message = JSON.parse(data.message)} catch (e) {/* don't handle */}
        log[data.level ? data.level : 'error'](data);
    });

    var LEVELS = [];
    LEVELS[10] = 'trace';
    LEVELS[20] = 'debug';
    LEVELS[30] = 'info';
    LEVELS[40] = 'warn';
    LEVELS[50] = 'error';
    LEVELS[60] = 'fatal';

    socket.on('logJSON', function(data) {
        if (data.level === 10 || data.level === 20 || data.level === 30 || data.level === 40 || data.level === 50 || data.level === 60) {
            data.level = LEVELS[data.level];
        }
        log[data.level ? data.level : 'error'](data);
    });

    var pageWrapper = document.getElementById('logger');
    socket.on('connect', function() {
        console.log('connected');
        socket.emit('test');
        pageWrapper.style.borderTop = 'none';
    });

    socket.on('disconnect', function() {
        pageWrapper.style.borderTop = '5px solid red';
    });

    /*log4javascript.Level.TAG = new log4javascript.Level(70000, "TAG");
     log4javascript.tag = function() {
     this.log(this.Level.TAG, arguments);
     };*/
    var log = log4javascript.getLogger('main');
    log.setLevel(log4javascript.Level.TRACE);
    var appender = new log4javascript.InPageAppender('logger', false, false, true, '100%', '100%');
    appender.setMaxMessages(5000);
    var layout = new log4javascript.JsonLayout();
    appender.setLayout(layout);
    /*layout.format = function() {
     debugger;
     }*/
    var consoleWin = null;
    appender.addEventListener('load', function() {
        consoleWin = appender.getConsoleWindow();
        var jss = consoleWin.parent.jss.forDocument(consoleWin.document);
        function setSearchMarkers(content) {
            var regexp = new RegExp('(' + consoleWin.currentSearch.searchTerm + ')', 'gi');
            for (var prop in content) {
                if (content.hasOwnProperty(prop) && typeof content[prop] == 'string') {
                    content[prop] = content[prop].replace(regexp, '<span class=\'searchterm\'>$1</span>');
                }
            }
            return content;
        }
        consoleWin.LogEntryElementContainer.prototype.setContent = function(content, wrappedContent) {
            var searched = consoleWin.currentSearch && (content !== this.logEntry.formattedMessage);
            if (typeof content !== 'object') {
                content = JSON.parse(this.logEntry.formattedMessage);
            }
            //var message = JSON.parse(content.message.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'));
            var time = content.timestamp ? new Date(content.timestamp) : new Date();
            content.time = '' + time.getFullYear() +
            '-' + ('00' + (time.getMonth() + 1)).substr(-2) +
            '-' + ('00' + time.getDay()).substr(-2) +
            ' ' + ('00' + time.getHours()).substr(-2) +
            ':' + ('00' + time.getMinutes()).substr(-2) +
            ':' + ('00' + time.getSeconds()).substr(-2);
            content.sender = (content.message && content.message.name) ? content.message.name : null;
            content.context = (content.message && content.message.context) ? content.message.context : null;
            content.opcode = (content.message && content.message.$$ && content.message.$$.opcode) ? content.message.$$.opcode : (content.message && content.message.message && content.message.message.$$ && content.message.message.$$.opcode) ? content.message.message.$$.opcode : (content.message && (typeof content.message.message === 'string')) ? content.message.message : '';

            if (typeof content.message != 'string') {
                try {
                    content.message =   '<span ondblclick="if (this.parentElement.className !==\'details\') {this.parentElement.className=\'details\'} else {this.parentElement.className=\'\'}">' +
                    ((content.message && content.message.msg) ? content.message.msg + '\r\n' : '') +
                    JSON.stringify(content.message, null, 2) +
                    '</span>';
                } catch (e) {/* don't handle */}
            }
            if (searched) {
                content = setSearchMarkers(content);
            }
            var detailsDiv = this.mainDiv.lastChild && this.mainDiv.lastChild.lastChild;
            this.mainDiv.innerHTML = '';
            var element;
            element = document.createElement('td');
            element.style.whiteSpace = 'nowrap';
            this.mainDiv.appendChild(element).innerHTML = content.time;
            this.mainDiv.appendChild(document.createElement('td')).innerHTML = content.level;
            this.mainDiv.appendChild(document.createElement('td')).innerHTML = content.sender || '';
            this.mainDiv.appendChild(document.createElement('td')).innerHTML = content.context || '';
            this.mainDiv.appendChild(document.createElement('td')).innerHTML = content.opcode;
            element = this.mainDiv.appendChild(document.createElement('td'));
            if (detailsDiv) {
                element = element.appendChild(detailsDiv);
            } else {
                element = element.appendChild(document.createElement('div'));
                element.className = 'details';
            }
            element.innerHTML = content.message;
        };
        consoleWin.LogEntryMainElementContainer = function(logEntry, containerDomNode) {
            this.logEntry = logEntry;
            this.containerDomNode = containerDomNode;
            this.mainDiv = document.createElement('tr');
            var customClasses = ' ';
            var msg = null;
            var name = null;
            var context = null;
            var className = null;
            try {
                msg = JSON.parse(logEntry.formattedMessage).message;
                if (msg.name) {
                    className = msg.name.replace(/ /g, '_');
                    customClasses += 'name_' + className + ' ';
                    jss.set('tr.logentry.' + 'name_' + className, {'display': 'table-row'});
                    jss.set('div.' + 'name_' + className + '#log *.logentry.' + 'name_' + className, {'display': 'none'});
                    customToolbars['name'].addOption(className, msg.name);
                }
                if (msg.context) {
                    className = msg.context.replace(/ /g, '_');
                    customClasses += 'context_' + className + ' ';
                    jss.set('tr.logentry.' + 'context_' + className, {'display': 'table-row'});
                    jss.set('div.' + 'context_' + className + '#log *.logentry.' + 'context_' + className, {'display': 'none'});
                    customToolbars['context'].addOption(className, msg.context);
                }
            } catch (e) {
                customClasses = '';
            }
            //customClasses += consoleWin.logEntries.length % 2 ? 'light ' : 'dark ';
            this.mainDiv.className = 'logentry nonielogentry' + customClasses + logEntry.level;
            this.setContent(logEntry.formattedMessage);
        };
        consoleWin.LogEntryMainElementContainer.prototype = new consoleWin.LogEntryElementContainer();

        // @overrides below
        consoleWin.applyFilters = function applyFilters() {
            for (var i = 0; i < consoleWin.logLevels.length; i++) {
                if (consoleWin.getCheckBox(consoleWin.logLevels[i]).checked) {
                    consoleWin.removeClass(consoleWin.logMainContainer, consoleWin.logLevels[i]);
                } else {
                    consoleWin.addClass(consoleWin.logMainContainer, consoleWin.logLevels[i]);
                }
            }
            consoleWin.updateSearchFromFilters();
        }

        consoleWin.toggleAllLevels = function toggleAllLevels() {
            var turnOn = consoleWin.$("switch_ALL").checked;
            for (var i = 0; i < consoleWin.logLevels.length; i++) {
                consoleWin.getCheckBox(consoleWin.logLevels[i]).checked = turnOn;
                if (turnOn) {
                    consoleWin.removeClass(consoleWin.logMainContainer, consoleWin.logLevels[i]);
                } else {
                    consoleWin.addClass(consoleWin.logMainContainer, consoleWin.logLevels[i]);
                }
            }
        }

        consoleWin.clearLog = function clearLog() {
            consoleWin.rootGroup.clear();
            consoleWin.currentGroup = consoleWin.rootGroup;
            consoleWin.logEntries = [];
            consoleWin.logItems = [];
            consoleWin.logEntriesAndSeparators = [];
            consoleWin.doSearch();
            console.log('overridden');
            for (var toolbar in customToolbars) {
                if (customToolbars.hasOwnProperty(toolbar)) {
                    customToolbars[toolbar].clearOptions();
                }
            }
        }
        // @overrides above

        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@                 @@@@@@@@
        // @@@@@@@@ custom toolbars @@@@@@@@
        // @@@@@@@@                 @@@@@@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

        var switches = jQuery('#switches', consoleWin.document);
        var customToolbars = {};

        // CustomToolbar component
        function CustomToolbar(id) {
            customToolbars[id] = this;
            this.id = id;
            this.options = {};
            this.element = jQuery('<div id="toolbar_' + id + '" class="toolbar"></div>');
            this.labelElement = jQuery('<span>' + (id.charAt(0).toUpperCase() + id.slice(1)) + ' :</span>')
            this.optionsElement = jQuery('<span></span>');
            this.allElement = jQuery('<input type="checkbox" id="' + this.id + '_ALL" checked="checked" title="Show/hide all messages" /><label for="' + this.id + '_ALL" id="' + this.id + '_label_ALL">all</label>')
            var self = this;
            this.allElement.click(function() {
                self.toggleAllOptions();
                self.applyFilters();
            });
            this.element.append([this.labelElement, this.optionsElement, this.allElement]);
            switches.prepend(this.element);
        }

        CustomToolbar.prototype.applyFilters = function() {
            var cssClass = '';
            for (var option in this.options) {
                if (this.options.hasOwnProperty(option)) {
                    cssClass = this.options[option][0].id;
                    this.options[option][0].checked ? consoleWin.removeClass(consoleWin.logMainContainer, cssClass) : consoleWin.addClass(consoleWin.logMainContainer, cssClass);
                }
            }
            consoleWin.updateSearchFromFilters();
        };
        CustomToolbar.prototype.toggleAllOptions = function() {
            var turnOn = this.allElement[0].checked;
            var cssClass = '';
            for (var option in this.options) {
                if (this.options.hasOwnProperty(option)) {
                    this.options[option][0].checked = turnOn;
                    cssClass = this.options[option][0].id;
                    turnOn ? consoleWin.removeClass(consoleWin.logMainContainer, cssClass) : consoleWin.addClass(consoleWin.logMainContainer, cssClass);
                }
            }
        };
        CustomToolbar.prototype.checkAllOptions = function() {
            for (var option in this.options) {
                if (this.options.hasOwnProperty(option)) {
                    if (!this.options[option][0].checked) {
                        this.allElement[0].checked = false;
                        return;
                    }
                }
            }
            this.allElement[0].checked = true;
        };
        CustomToolbar.prototype.addOption = function(id, value) {
            if (this.options[id]) {
                return;
            }
            this.options[id] = jQuery('<input type="checkbox" id="' + this.id + '_' + id + '" checked="checked" title="Show/hide ' + value + ' messages" /><label for="' + this.id + '_' + id + '" id="label_' + this.id + '_' + id + '">' + value + '</label>');
            var self = this;
            this.options[id].click(function() {
                self.applyFilters();
                self.checkAllOptions();
            });
            this.optionsElement.append(this.options[id]);
        };

        CustomToolbar.prototype.clearOptions = function() {
            for (var option in this.options) {
                if (this.options.hasOwnProperty(option)) {
                    consoleWin.removeClass(consoleWin.logMainContainer, this.options[option][0].id);
                    this.options[option].click = null;
                    this.options[option] = null;
                }
            }
            this.options = {};
            this.optionsElement.html('');
            this.checkAllOptions();
        };

        new CustomToolbar('name');
        new CustomToolbar('context');

        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@                 @@@@@@@@
        // @@@@@@@@  Plugins start  @@@@@@@@
        // @@@@@@@@                 @@@@@@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

        var optionsBar = jQuery('#options', consoleWin.document);
        var pluginsContainer = jQuery('<span style="display: inline-block; float: right"></span>');
        optionsBar.append(pluginsContainer);

        var dateTimePicker = jQuery('#dateTimePicker');

        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@   file upload   @@@@@@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@

        var uploadForm = jQuery('<form enctype="multipart/form-data" style="display: inline-block;"></form>');
        var uploadFormFile = jQuery('<input name="file" style="width: 150px" type="file" class="button"/>');
        var uploadFormSubmit = jQuery('<input type="button" value="Load" class="button"/>');
        uploadForm.append([uploadFormFile, uploadFormSubmit]);
        pluginsContainer.append(uploadForm);
        var file = null;
        uploadFormFile.change(function(evt) {
            file = this.files[0];
            // maybe add validation
            //var name = file.name;
            //var size = file.size;
            //var type = file.type;
        });
        uploadFormSubmit.click(function(evt) {
            if (!file) { return; }
            var formData = new FormData();
            formData.append('files', file);
            jQuery.ajax({
                url: '/upload-logs',
                type: 'POST',
                data: formData,
                processData: false,
                contentType: false
            });
        });

        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@  logs querying  @@@@@@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        var inputStyle = ' style="font-size: 100%; margin-right: 5px; width: 100px; font-family: tahoma, verdana, arial, helvetica, sans-serif;" '
        var queryForm = jQuery('<form style="display: inline-block; padding-left: 20px; margin-left: 20px; border-left: 1px solid grey"></form>');
        var queryFrom = jQuery('<input type="text"' + inputStyle + 'data-field="datetime" readonly="">');
        var queryTo = jQuery('<input type="text"' + inputStyle + 'data-field="datetime" readonly="">');
        var doQuery = jQuery('<input type="button" class="button" value="Search">');
        queryForm.append([queryFrom, queryTo, doQuery]);
        pluginsContainer.append(queryForm);
        doQuery.click(function(evt) {
            var from = queryFrom.val();
            var to = queryTo.val();
            if (!from || !to) {
                return;
            }
            from = from.split(/[-: ]/);
            to = to.split(/[-: ]/);
            jQuery.ajax({
                url: '/query-logs',
                type: 'POST',
                data: JSON.stringify({
                    from: (new Date(from[2], from[1] - 1, from[0], from[3], from[4])).getTime(),
                    to: (new Date(to[2], to[1] - 1, to[0], to[3], to[4])).getTime()
                }),
                contentType: 'application/json'
            });
        });
        dateTimePicker.DateTimePicker({mode: 'datetime', parentElement: queryForm});

        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@                 @@@@@@@@
        // @@@@@@@@   Plugins end   @@@@@@@@
        // @@@@@@@@                 @@@@@@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
        // clear LogMainContainer classes initially
        consoleWin.logMainContainer.className = '';
    });
    log.addAppender(appender);
});
