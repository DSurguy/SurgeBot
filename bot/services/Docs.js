module.exports = Docs;
function Docs(){
    this._list = {
        commands: [],
        passives: [],
        services: [],
        middleware: []
    };
    this._commands = {};
    this._passives = {};
    this._services = {};
    this._middleware = {};
};

Docs.prototype.addCommandDoc = function(cmd, doc){
    this._commands[cmd] = doc;
    this._list.commands.push(cmd);
};
Docs.prototype.getCommandDoc = function(cmd){
    return this._commands[cmd];
};

Docs.prototype.addServiceDoc = function(service, doc){
    this._services[service] = doc;
    this._list.services.push(service);
};
Docs.prototype.getServiceDoc = function(service){
    return this._services[service];
};

Docs.prototype.addPassiveDoc = function(label, doc){
    this._passives[label] = doc;
    this._list.passives.push(label);
};
Docs.prototype.getPassiveDoc = function(label){
    return this._passives[label];
};

Docs.prototype.getList = function(){
    return this._list;
};