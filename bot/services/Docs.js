var extend = require('extend');

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

Docs.prototype.addDoc = function(type, label, doc){
    //reject malformed docs
    if( doc.length >= 1 && typeof doc == 'object' ){
        for( var i=0; i<doc.length; i++ ){
            if( typeof doc[i] !== 'string' ){
                throw new Error('Malformed doc for '+type+': '+label);
                return false;
            }
        }
    }
    else {
        throw new Error('Malformed doc for '+type+': '+label);
        return false;
    }

    //add the doc to the correct objects based on the type of binding
    switch(type){
        case 'service':
            this._services[label] = doc;
            this._list.services.push(label);
        break;
        case 'command':
            this._commands[label] = doc;
            this._list.commands.push(label);
        break;
        case 'middleware':
            this._middleware[label] = doc;
            this._list.middleware.push(label);
        break;
        case 'passive':
            this._passives[label] = doc;
            this._list.passives.push(label);
        break;
        default:
            throw new Error('Unsupported document type: '+type+' for label: '+label);
            return false;
        break;
    }

    //notify success
    return true;
};

Docs.prototype.getDoc = function(type, label){
    switch(type){
        case 'service':
            if( this._services[label] ){
                return extend(true, [], this._services[label]); 
            }
            else{
                return undefined;
            }
        break;
        case 'command':
            if( this._commands[label] ){
                return extend(true, [], this._commands[label]);
            }
            else{
                return undefined
            }
        break;
        case 'middleware':
            if( this._middleware[label] ){
                return extend(true, [], this._middleware[label]);
            }
            else{
                return undefined
            }
        break;
        case 'passive':
            if( this._passives[label] ){
                return extend(true, [], this._passives[label]);
            }
            else{
                return undefined
            }
        break;
        default:
            throw new Error('Unsupported document type: '+type+' for label: '+label);
            return undefined;
        break;
    }
};

Docs.prototype.getList = function(){
    return extend(true, {}, this._list);
};