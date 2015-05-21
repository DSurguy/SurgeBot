module.exports = function(item){
	if( typeof item !== "object" && typeof item !== "function" && typeof item !== "undefined" && item != null ){
        //we cloned an object literal, it should have a valueOf function
        return item.valueOf();
    }
    if( typeof item === "undefined"){
        //we can't clone an undefined object, return undefined
        return undefined;
    }
    if( item == null ){
    	//we can't clone null, so just return null
    	return null;
    }
	//preserve the classname of the item being cloned
	var newObj = new item.constructor;
	//copy the values
	for( var key in item ){
		if( item.hasOwnProperty(key) ){
			if( typeof item[key] == "object" ){
				//this is also an object, recurse and clone it so we don't get any references!
				newObj[key] = ALDB.Clone(item[key]);
			}
			else{
				newObj[key] = item[key];
			}
		}
	}
    //remove properties that were removed after object construction
    for( var key in newObj ){
        if( !item.hasOwnProperty(key) ){
            delete newObj[key];
        }
    }
	//spit out the clone
	return newObj;
}