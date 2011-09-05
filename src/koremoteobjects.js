(function (window, undefined) {
	var remoteSettings = {
		"getUrl": null,
		"useRestMethods": undefined,
		"ajax": {
			"dataType": undefined,
			"context": undefined		
		}
	};
	
	if (window.jQuery === undefined) {
		throw "koRemoteObjects requires jQuery to be loaded first";
	}
	
	ko.remoteSetup = function (options) {
		remoteSettings = jQuery.extend(remoteSettings, options);
	}
	
	ko.remoteable = function (observable, type, options) {
		var self = this,
			isArray = typeof this.pop == "function",
			state = ko.observable("init"),
			error = ko.observable(),
			settings = jQuery.extend({
				"data": undefined,
				"useRestMethods": undefined,
				"ajax": {
					"dataType": undefined,
					"context": undefined
				}
			}, options);
		
		function getAjaxCallbacks(action, successes, errors, completes) {
			function applyForEachCallback(callbacks, args) {
				for (var i = 0, j = callbacks.length; i < j; i++) {
					if (callbacks[i]) {
						callbacks[i].apply(settings.ajax.context || remoteSettings.ajax.context || $.ajaxSettings.context, args);
					}
				}
			}		
			
			return {
				success: function (data, textStatus, jqXHR) {
					applyForEachCallback(successes, [data, textStatus, jqXHR, action, type]);
				},
				error: function (jqXHR, textStatus, errorThrown) {
					applyForEachCallback(errors, [jqXHR, textStatus, errorThrown, action, type]);
				},
				complete: function (jqXHR, textStatus) {
					applyForEachCallback(completes, [jqXHR, textStatus, action, type]);
				}			
			};
		}
		
		function ajax(action, data, method, onSuccess, onError, onComplete) {
			var startState = state(),
				successes, errors, completes;
		
			function addEnding(word, ending) {
				var rootWord = word.substr(word.length - 1) == "e" ? word.substr(0, word.length - 1) : word;
				return rootWord + ending;
			}
			
			successes = [function (result, textStatus, jqXHR) {
				var defaultError;
				
				parsedResult = self.parseResult.call(self, action, type, result);
				if (parsedResult && parsedResult.success) {
					observable(parsedResult.data || {});
					state(addEnding(action, "ed"));
					error(undefined);
				}
				else {
					state(startState);
					defaultError = "Error " + addEnding(action, "ing") + " " + type;
					error(parsedResult ? parsedResult.error || defaultError : defaultError);
				}
			}, onSuccess, settings.ajax.success, remoteSettings.ajax.success];
			
			errors = [function (jqXHR, textStatus, errorThrown) {
				state(startState);
				error(errorThrown);
			}, onError, settings.ajax.error, remoteSettings.ajax.error];
			
			completes = [onComplete, settings.ajax.complete, remoteSettings.ajax.complete];
			
			state(addEnding(action, "ing"));
			
			jQuery.ajax(jQuery.extend({}, remoteSettings.ajax, settings.ajax, getAjaxCallbacks("create", successes, errors, completes), {
				url: this.getUrl(action, type, method),
				type: this.getMethod(action, type, method),
				data: this.parseRequestData(action, type, data)
			}));		
		}
		
		function useRestMethods(ifRest, ifNotRest) {
			// the settings flag overrides and remote settings flag, but they are both boolean so we have to do the dance
			return (settings.useRestMethods === true) || ((settings.useRestMethods === undefined) && (remoteSettings.useRestMethods === true)) ? ifRest : ifNotRest;
		}
		
		// adapted from http://v3.javascriptmvc.com/jquery/dist/jquery.formparams.js
		function getFormData(form, convert) {
			var radioCheck = /radio|checkbox/i,
				keyBreaker = /[^\[\]]+/g,
				numberMatcher = /^[\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?$/,
				data = {},
				current;

			function isNumber( value ) {
				if ( typeof value == 'number' ) {
					return true;
				}
				if ( typeof value != 'string' ) {
					return false;
				}
				return value.match(numberMatcher);
			};

			if (form.nodeName.toLowerCase() !== 'form' || !form.elements ) {
				throw "Non form element passed to getFormData()";
			}
			
			convert = convert === undefined ? true : convert;
			
			jQuery.each(jQuery.makeArray(form.elements), function (index, el) {

				var type = el.type && el.type.toLowerCase();
				
				//if we are submit, ignore
				if ((type == 'submit') || !el.name ) {
					return;
				}

				var key = el.name,
					value = $.data(el, "value") || $.fn.val.call([el]),
					isRadioCheck = radioCheck.test(el.type),
					parts = key.match(keyBreaker),
					write = !isRadioCheck || !! el.checked,
					//make an array of values
					lastPart;

				if ( convert ) {
					if ( isNumber(value) ) {
						value = parseFloat(value);
					} else if ( value === 'true' || value === 'false' ) {
						value = Boolean(value);
					}
				}

				// go through and create nested objects
				current = data;
				for ( var i = 0; i < parts.length - 1; i++ ) {
					if (!current[parts[i]] ) {
						current[parts[i]] = {};
					}
					current = current[parts[i]];
				}
				lastPart = parts[parts.length - 1];

				//now we are on the last part, set the value
				if ( lastPart in current && type === "checkbox" ) {
					if (!$.isArray(current[lastPart]) ) {
						current[lastPart] = current[lastPart] === undefined ? [] : [current[lastPart]];
					}
					if ( write ) {
						current[lastPart].push(value);
					}
				} else if ( write || !current[lastPart] ) {
					current[lastPart] = write ? value : undefined;
				}
			});
			
			return data;
		}
		
		this.getUrl = function (action, type, method) {
			if (settings.getUrl) {
				return settings.getUrl(action, type, method);
			}
			if (remoteSettings.getUrl) {
				return remoteSettings.getUrl(action, type, method);
			}
			return action + type.substr(0, 1).toUpperCase() + type.substr(1);
		}
		
		this.getMethod = function (action, type, method) {
			if (settings.getMethod) {
				return settings.getMethod(action, type, method);
			}
			if (remoteSettings.getMethod) {
				return remoteSettings.getMethod(action, type, method);
			}
			return method;
		}
		
		this.parseRequestData = function (action, type, data) {
			if (settings.parseRequestData !== undefined) {
				return settings.parseRequestData(action, type, data);
			}
			if (remoteSettings.parseRequestData !== undefined) {
				return remoteSettings.parseRequestData(action, type, data);
			}
			return data;
		}		
		
		this.parseResult = function (action, type, result) {
			if (settings.parseResult !== undefined) {
				return settings.parseResult(action, type, result);
			}
			if (remoteSettings.parseResult !== undefined) {
				return remoteSettings.parseResult(action, type, result);
			}
			return result;
		}		
		
		this.init = function (data) {
			state("init");
			observable(data);
		}
		
		this.load = function (data, onSuccess, onError, onComplete) {
			ajax.call(self, "load", data, "GET", onSuccess, onError, onComplete);
		}
		
		this.create = function (data, onSuccess, onError, onComplete) {
			ajax.call(self, "create", data, "POST", onSuccess, onError, onComplete);
		}
		
		this.createFromForm = function (form, onSuccess, onError, onComplete) {
			self.create(getFormData(form), onSuccess, onError, onComplete);
		}
		
		this.update = function (data, onSuccess, onError, onComplete) {
			var mergedData = jQuery.extend({}, observable(), data);
			ajax.call(self, "update", mergedData, useRestMethods("PUT", "POST"), onSuccess, onError, onComplete);
		}
		
		this.updateFromForm = function (form, onSuccess, onError, onComplete) {
			self.update(getFormData(form), onSuccess, onError, onComplete);
		}
		
		this.save = function (data, onSuccess, onError, onComplete) {
			state() == "init" ? self.create.call(self, data, onSuccess, onError, onComplete) : self.update.call(self, data, onSuccess, onError, onComplete);
		}
		
		this.saveFromForm = function (form, onSuccess, onError, onComplete) {
			self.save(getFormData(form), onSuccess, onError, onComplete);
		}
		
		this.destroy = function (data, onSuccess, onError, onComplete) {
			ajax.call(self, "destroy", data, useRestMethods("DELETE", "POST"), onSuccess, onError, onComplete);
		}
		
		ko.exportProperty(this, 'init', this.init);
		ko.exportProperty(this, 'load', this.load);
		ko.exportProperty(this, 'create', this.create);
		ko.exportProperty(this, 'createFromForm', this.createFromForm);
		ko.exportProperty(this, 'update', this.update);
		ko.exportProperty(this, 'updateFromForm', this.updateFromForm);
		ko.exportProperty(this, 'save', this.save);
		ko.exportProperty(this, 'saveFromForm', this.saveFromForm);
		ko.exportProperty(this, 'destroy', this.destroy);
		ko.exportProperty(this, 'state', state);
		ko.exportProperty(this, 'error', error);
	}
	
	ko.isRemoteable = function (instance) {
		return typeof instance.init == "function" && typeof instance.create == "function" && typeof instance.load == "function" && typeof instance.update == "function" && typeof instance.remove == "function";
	};	

	ko.remoteObservable = function (type, options) {
		var settings = jQuery.extend({data: {}}, options),
			observable = ko.observable({}),
			hasData = ko.dependentObservable(function () {
				var value = observable();
				return !jQuery.isEmptyObject(value);
			}),
			hasNoData = ko.dependentObservable(function () {
				return !hasData();
			}),
			i;
		
		function remoteObservable() {
			if (arguments.length > 0) {
				observable.apply(this, arguments);
				return this;
			}
			else {
				return observable();
			}		
		}
		
		// inherit all the observable properties
		for (i in observable) {
			remoteObservable[i] = observable[i];
		}
		
		// intercept the value mutating from the arrays
		remoteObservable.valueHasMutated = function () { 
			observable.valueHasMutated(); 
		}
		
		// make it remoteable
		ko.remoteable.call(remoteObservable, observable, type, options);
		
		// add our own custom methods
		remoteObservable.clearData = function () {
			observable({});
			remoteObservable.state("init");
		}
		
		ko.exportProperty(remoteObservable, 'hasData', hasData);
		ko.exportProperty(remoteObservable, 'hasNoData', hasNoData);
		ko.exportProperty(remoteObservable, 'clearData', remoteObservable.clearData);
		
		return remoteObservable;
	};
	
	// the exact same as ko.observableArray except for the first two lines, I feel bad for all this copy pasta but result is buried in observableArray
	ko.remoteObservableArray = function (type, options) {
		var result = new ko.remoteObservable([]);
		
		ko.remoteable.call(result, result, type, options);
		
		ko.utils.arrayForEach(["pop", "push", "reverse", "shift", "sort", "splice", "unshift"], function (methodName) {
			result[methodName] = function () {
				var underlyingArray = result();
				var methodCallResult = underlyingArray[methodName].apply(underlyingArray, arguments);
				result.valueHasMutated();
				return methodCallResult;
			};
		});

		ko.utils.arrayForEach(["slice"], function (methodName) {
			result[methodName] = function () {
				var underlyingArray = result();
				return underlyingArray[methodName].apply(underlyingArray, arguments);
			};
		});

		result.remove = function (valueOrPredicate) {
			var underlyingArray = result();
			var remainingValues = [];
			var removedValues = [];
			var predicate = typeof valueOrPredicate == "function" ? valueOrPredicate : function (value) { return value === valueOrPredicate; };
			for (var i = 0, j = underlyingArray.length; i < j; i++) {
				var value = underlyingArray[i];
				if (!predicate(value))
					remainingValues.push(value);
				else
					removedValues.push(value);
			}
			result(remainingValues);
			return removedValues;
		};

		result.removeAll = function (arrayOfValues) {
			// If you passed zero args, we remove everything
			if (arrayOfValues === undefined) {
				var allValues = result();
				result([]);
				return allValues;
			}
			
			// If you passed an arg, we interpret it as an array of entries to remove
			if (!arrayOfValues)
				return [];
			return result.remove(function (value) {
				return ko.utils.arrayIndexOf(arrayOfValues, value) >= 0;
			});
		};
		
		result.destroy = function (valueOrPredicate) {
			var underlyingArray = result();
			var predicate = typeof valueOrPredicate == "function" ? valueOrPredicate : function (value) { return value === valueOrPredicate; };
			for (var i = underlyingArray.length - 1; i >= 0; i--) {
				var value = underlyingArray[i];
				if (predicate(value))
					underlyingArray[i]["_destroy"] = true;
			}
			result.valueHasMutated();
		};
		
		result.destroyAll = function (arrayOfValues) {
			// If you passed zero args, we destroy everything
			if (arrayOfValues === undefined)
				return result.destroy(function() { return true });
					
			// If you passed an arg, we interpret it as an array of entries to destroy
			if (!arrayOfValues)
				return [];
			return result.destroy(function (value) {
				return ko.utils.arrayIndexOf(arrayOfValues, value) >= 0;
			});		    	
		};

		result.indexOf = function (item) {
			var underlyingArray = result();
			return ko.utils.arrayIndexOf(underlyingArray, item);
		};
		
		result.replace = function(oldItem, newItem) {
			var index = result.indexOf(oldItem);
			if (index >= 0) {
				result()[index] = newItem;
				result.valueHasMutated();
			}	
		};
		
		ko.exportProperty(result, "remove", result.remove);
		ko.exportProperty(result, "removeAll", result.removeAll);
		ko.exportProperty(result, "destroy", result.destroy);
		ko.exportProperty(result, "destroyAll", result.destroyAll);
		ko.exportProperty(result, "indexOf", result.indexOf);
		
		return result;
	}
	
	ko.exportSymbol('ko.remoteable', ko.remoteable);
	ko.exportSymbol('ko.isRemoteable', ko.isRemoteable);	
	ko.exportSymbol('ko.remoteSetup', ko.remoteSetup);	
	ko.exportSymbol('ko.remoteObservable', ko.remoteObservable);
	ko.exportSymbol('ko.remoteObservableArray', ko.remoteObservableArray);
	
})(window);

