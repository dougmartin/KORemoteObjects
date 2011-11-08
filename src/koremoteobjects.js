(function (window, undefined) {
	var remoteSettings = {
		"getUrl": undefined,
		"useRestMethods": undefined,
		"ajax": {
			"dataType": undefined
		}
	};
	
	if (jQuery === undefined) {
		throw "koRemoteObjects requires jQuery to be loaded first";
	}
	if (ko.observable["fn"] === undefined) {
		throw "koRemoteObjects requires Knockout 1.3 or above";
	}
	
	ko.remoteSetup = function (options) {
		remoteSettings = jQuery.extend(remoteSettings, options);
	}
	
	ko.remoteable = function (type, options) {
		var self = this,
			state = ko.observable("init"),
			error = ko.observable(),
			hasData = ko.dependentObservable(function () {
				var value = self();
				return !jQuery.isEmptyObject(value);
			}),
			isArray = false,			
			settings = jQuery.extend({
				"model": undefined,
				"validate": undefined,
				"useRestMethods": undefined,
				"ajax": {
					"dataType": undefined
				}
			}, options);
			
		this.remote = {
			"rootObject": this,
			"type": type,
			"settings": settings,
			"state": state,
			"error": error,
			"isArray": isArray,
			"hasData": hasData
		};
		ko.utils.extend(this.remote, ko.remoteable["fn"]);
		
		this.remote.helpers = {
			"rootObject": this,
			"remote": this.remote
		};
		ko.utils.extend(this.remote.helpers, remoteableHelpers);

		ko.exportProperty(this, "remote", this.remote);
	}
	
	remoteableHelpers = {
		ajax: function (action, data, method, onSuccess, onError, onComplete) {
			var startState = this.remote.state(),
				self = this,
				beforeSends, successes, errors, completes;
		
			function addEnding(word, ending) {
				var rootWord = word.substr(word.length - 1) == "e" ? word.substr(0, word.length - 1) : word;
				return rootWord + ending;
			}
			
			// self is used in here as the callbacks come in with this assigned to window by jQuery.ajax()
			// we can't set the context on jQuery.ajax
			function getAjaxCallbacks(action, beforeSends, successes, errors, completes) {
				
				function applyForEachCallback(callbacks, args) {
					for (var i = 0, j = callbacks.length; i < j; i++) {
						if (callbacks[i]) {
							callbacks[i].apply(self, args);
						}
					}
				}		
				
				return {
					beforeSend: function (jqXHR, settings) {
						applyForEachCallback.call(self, beforeSends, [jqXHR, settings]);
					},
					success: function (data, textStatus, jqXHR) {
						applyForEachCallback.call(self, successes, [parseResult.call(self, data), data, textStatus, jqXHR, action, self.remote.type]);
					},
					error: function (jqXHR, textStatus, errorThrown) {
						applyForEachCallback.call(self, errors, [jqXHR, textStatus, errorThrown, action, self.remote.type]);
					},
					complete: function (jqXHR, textStatus) {
						applyForEachCallback.call(self, completes, [jqXHR, textStatus, action, self.remote.type]);
					}			
				};
			}
			
			function getUrl(action, type, method) {
				if (this.remote.settings.getUrl) {
					return this.remote.settings.getUrl(action, type, method);
				}
				if (remoteSettings.getUrl) {
					return remoteSettings.getUrl(action, type, method);
				}
				return action + type.substr(0, 1).toUpperCase() + type.substr(1);
			}
			
			function getMethod(action, type, method) {
				if (this.remote.settings.getMethod) {
					return this.remote.settings.getMethod(action, type, method);
				}
				if (remoteSettings.getMethod) {
					return remoteSettings.getMethod(action, type, method);
				}
				return method;
			}

			function parseRequestData(action, type, data) {
				if (this.remote.settings.parseRequestData) {
					return this.remote.settings.parseRequestData(action, type, data);
				}
				if (remoteSettings.parseRequestData) {
					return remoteSettings.parseRequestData(action, type, data);
				}
				return data;
			}

			function parseResult(result) {
				if (this.remote.settings.parseResult) {
					return this.remote.settings.parseResult(action, type, result);
				}
				if (remoteSettings.parseResult) {
					return remoteSettings.parseResult(action, type, result);
				}
				
				// convert to standard form if not already in it
				if (!result.hasOwnProperty("success")) {
					return {
						success: true,
						data: result
					};
				}
				
				return result;
			}
			
			beforeSends = [function (jqXHR, settings) {
				this.log({"action": action, "method": settings.type, "url": settings.url, "data": data});
			}, this.remote.settings.ajax.beforeSend, remoteSettings.ajax.beforeSend];
			
			successes = [function (result, textStatus, jqXHR) {
				var parsedResult = parseResult.call(this, result),
					parsedData = parsedResult ? parsedResult.data || {} : {},
					model = this.remote.settings.model,
					defaultError, modelArray;
				
				function convertToModel(data) {
					return model ? new model(data) : data;
				}
				
				if (parsedResult && parsedResult.success) {
					if (this.remote.isArray) {
						modelArray = [];
						if (jQuery.isArray(parsedData)) {
							jQuery.each(parsedData, function (i, parsedDatum) {
								modelArray.push(convertToModel.call(this, parsedDatum));
							});
						}
						else {
							modelArray.push(convertToModel.call(this, parsedData));
						}
						this.rootObject(modelArray);
					}
					else {
						this.rootObject(convertToModel.call(this, parsedData))
					}
					this.remote.state(addEnding(action, "ed"));
					this.remote.error(undefined);
				}
				else {
					this.remote.state(startState);
					defaultError = "Error " + addEnding(action, "ing") + " " + this.remote.type;
					this.remote.error(parsedResult ? parsedResult.error || defaultError : defaultError);
				}
			}, onSuccess, this.remote.settings.ajax.success, remoteSettings.ajax.success];
			
			errors = [function (jqXHR, textStatus, errorThrown) {
				this.remote.state(startState);
				this.remote.error(errorThrown);
			}, onError, this.remote.settings.ajax.error, remoteSettings.ajax.error];
			
			completes = [onComplete, this.remote.settings.ajax.complete, remoteSettings.ajax.complete];
			
			this.remote.state(addEnding(action, "ing"));
			
			jQuery.ajax(jQuery.extend({}, remoteSettings.ajax, this.remote.settings.ajax, getAjaxCallbacks("create", beforeSends, successes, errors, completes), {
				url: getUrl.call(this, action, this.remote.type, method),
				type: getMethod.call(this, action, this.remote.type, method),
				data: parseRequestData.call(this, action, this.remote.type, data)
				// context: this.remote <-- don't do this, because you'll be a stack overflow with the circular reference back to the root object
			}));		
		},
		
		useRestMethods: function (ifRest, ifNotRest) {
			// the settings flag overrides and remote settings flag, but they are both boolean so we have to do the dance
			return (this.remote.settings.useRestMethods === true) || ((this.remote.settings.useRestMethods === undefined) && (remoteSettings.useRestMethods === true)) ? ifRest : ifNotRest;
		},
		
		getFormValidator: function (form) {
			var $form = $(form), 
				formName = $form.attr("name"),
				validationSettings;
			
			function getValidationSettings(o, formName) {
				if (typeof o.validate == "boolean") {
					return o.validate ? {} : false;
				}
				if (jQuery.isFunction(o.validate)) {
					return o.validate(formName);
				}
				if (typeof o.validate == "object") {
					if (formName && o.validate.hasOwnProperty(formName)) {
						return o.validate[formName];
					}
					return o.validate;
				}
				return undefined;
			}

			validationSettings = getValidationSettings(this.remote.settings);
			if (validationSettings === false) {
				validationSettings = getValidationSettings(remoteSettings, formName);
			}
			return validationSettings !== false ? $form.validate(validationSettings || {}) : false;
		},
		
		// adapted from http://v3.javascriptmvc.com/jquery/dist/jquery.formparams.js
		getFormData: function (formOrData, convert) {
			var radioCheck = /radio|checkbox/i,
				keyBreaker = /[^\[\]]+/g,
				numberMatcher = /^[\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?$/,
				data = {},
				form, current, validator;

			function isNumber( value ) {
				if ( typeof value == "number" ) {
					return true;
				}
				if ( typeof value != "string" ) {
					return false;
				}
				return value.match(numberMatcher);
			};
			
			form = formOrData || this.remote.settings.form;
			if (!form) {
				return formOrData;
			}
			
			if (form.nodeName.toLowerCase() !== "form" || !form.elements ) {
				throw "Non form element passed to getFormData()";
			}
			
			convert = convert === undefined ? true : convert;
			
			// do optional validation 
			if (form && jQuery.fn.validate) {
				validator = this.getFormValidator(form);
				if (validator && !validator.form()) {
					return false;
				}
			}
			
			jQuery.each(jQuery.makeArray(form.elements), function (index, el) {

				var type = el.type && el.type.toLowerCase();
				
				//if we are submit, ignore
				if ((type == "submit") || !el.name ) {
					return;
				}

				var key = el.name,
					value = $.data(el, "value") || $.fn.val.call([el]),
					isRadioCheck = radioCheck.test(el.type),
					parts = key.match(keyBreaker),
					write = !isRadioCheck || !! el.checked,
					//make an array of values
					lastPart;

				if (convert) {
					if (isNumber(value)) {
						value = parseFloat(value);
					} else if (value === "true" || value === "false") {
						value = Boolean(value);
					}
				}

				// go through and create nested objects
				current = data;
				for (var i = 0; i < parts.length - 1; i++) {
					if (!current[parts[i]]) {
						current[parts[i]] = {};
					}
					current = current[parts[i]];
				}
				lastPart = parts[parts.length - 1];

				//now we are on the last part, set the value
				if (lastPart in current && type === "checkbox") {
					if (!$.isArray(current[lastPart])) {
						current[lastPart] = current[lastPart] === undefined ? [] : [current[lastPart]];
					}
					if (write) {
						current[lastPart].push(value);
					}
				} else if (write || !current[lastPart]) {
					current[lastPart] = write ? value : undefined;
				}
			});
			
			return data;
		},
		
		checkForFormData: function (data) {
			if ((data === undefined) || (data instanceof HTMLFormElement)) {
				return this.getFormData(data);
			}
			return data;
		},
		
		log: function (data) {
			if (ko.remoteObservable.debug) {
				ko.remoteObservable.debugLog.push(jQuery.extend({}, data, {
					type: this.remote.type
				}));
			}
		}
	};
		
	// these function reside under .remote, this refers to object.remote, not object
	ko.remoteable["fn"] = {
		cacheKey: null,
		
		createCacheKey: function (data) {
			var key = [];
			jQuery.each(data || {}, function (name, value) {
				key.push(name + ":" + value);
			});
			return key.join("|");		
		},
		
		init: function (data) {
			this.helpers.log({"action": "init"});
			this.state("init");
			this.rootObject(data);
		},
		
		clear: function () {
			this.cacheKey = null;
			this.state("init");
			this.rootObject(this.isArray ? [] : {});
		},
		
		load: function (data, onSuccess, onError, onComplete) {
			checkedData = this.helpers.checkForFormData(data);
			if (checkedData !== false) {
				this.cacheKey = this.createCacheKey(checkedData);
				this.helpers.ajax("load", checkedData, "GET", onSuccess, onError, onComplete);
			}
		},
		
		isCached: function (data) {
			return this.cacheKey == this.createCacheKey(data);
		},
		
		loadIfNotCached: function (data, onSuccess, onError, onComplete) {
			checkedData = this.helpers.checkForFormData(data);
			if (checkedData !== false) {
				if (!this.isCached(checkedData)) {
					this.load(data, onSuccess, onError, onComplete);
				}
				else if (onSuccess) {
					onSuccess(this.rootObject());
				}
			}
		},
		
		create: function (data, onSuccess, onError, onComplete) {
			checkedData = this.helpers.checkForFormData(data);
			if (checkedData !== false) {
				this.helpers.ajax("create", jQuery.extend({}, this.rootObject(), checkedData), "POST", onSuccess, onError, onComplete);
			}
		},
		
		update: function (data, onSuccess, onError, onComplete) {
			checkedData = this.helpers.checkForFormData(data);
			if (checkedData !== false) {
				this.helpers.ajax("update", jQuery.extend({}, this.rootObject(), checkedData), this.helpers.useRestMethods("PUT", "POST"), onSuccess, onError, onComplete);
			}
		},
		
		save: function (data, onSuccess, onError, onComplete) {
			checkedData = this.helpers.checkForFormData(data);
			if (checkedData !== false) {
				this.state() == "init" ? this.create.call(this, checkedData, onSuccess, onError, onComplete) : this.update.call(this, data, onSuccess, onError, onComplete);
			}
		},
		
		destroy: function (data, onSuccess, onError, onComplete) {
			checkedData = this.helpers.checkForFormData(data);
			if (checkedData !== false) {
				this.helpers.ajax("destroy", checkedData, this.helpers.useRestMethods("DELETE", "POST"), onSuccess, onError, onComplete);
			}
		},
		
		resetForm: function (form) {
			var validator;
			
			if (form && jQuery.fn.validate) {
				validator = this.helpers.getFormValidator(form);
				if (validator) {
					validator.resetForm();
				}
			}
		}
	}
	
	ko.isRemoteable = function (instance) {
		return typeof instance.init == "function" && typeof instance.create == "function" && typeof instance.load == "function" && typeof instance.update == "function" && typeof instance.remove == "function";
	};	

	ko.remoteObservable = function (type, options, initialValue) {
		var observable = ko.observable(initialValue || {});
		
		function remoteObservable() {
			if (arguments.length > 0) {
				if ((!observable["equalityComparer"]) || !observable["equalityComparer"](observable(), arguments[0])) {
					observable.apply(remoteObservable, arguments);
					remoteObservable.valueHasMutated();
				}
				return this;
			}
			
			return observable();
		}
		
		// make it subscribeable and remoteable
		ko.subscribable.call(remoteObservable);
		ko.remoteable.call(remoteObservable, type, options);
		
		ko.utils.extend(remoteObservable, ko.remoteObservable["fn"]);
		
		return remoteObservable;
	};
	
	// inherit all the observable properties and set our own remote properties
	ko.remoteObservable["fn"] = ko.utils.extend({}, ko.observable["fn"]);
	ko.utils.extend(ko.remoteObservable["fn"], {
		valueHasMutated: function () { 
			this.notifySubscribers(this());
		}
	});
	
	ko.remoteObservable.debug = false;
	ko.remoteObservable.debugLog = ko.observableArray();
	ko.bindingHandlers.remoteObservableDebugLog = {
		init: function(element, valueAccessor, allBindingsAccessor, viewModel) {
			$(element).html("<table class='remoteObservableDebugLog'><thead><tr><th>Action</th><th>Type</th><th>Method</th><th>URL</th><th>Data</th></tr></thead><tbody></tbody></table>");
		},
		update: function(element, valueAccessor, allBindingsAccessor, viewModel) {
			var rows = [];
			jQuery.each(ko.utils.unwrapObservable(valueAccessor()), function (index, logEntry) {
				var cells = [];
				jQuery.each(["action", "type", "method", "url", "data"], function (index, logItem) {
					var value = logEntry.hasOwnProperty(logItem) ? logEntry[logItem] : "&nbsp;";
					if (typeof value === "object") {
						value = ko.toJSON(value);
					}
					cells.push("<td>" + value + "</td>");
				})
				rows.push("<tr>" + cells.join("") + "</tr>");
			});
			$(element).find("tbody").html(rows.join(""));
		}
	};
	
	// the exact same as ko.observableArray except for the first two lines, I feel bad for all this copy pasta but result is buried in observableArray
	ko.remoteObservableArray = function (type, options) {
		var result = new ko.remoteObservable(type, options, []);
		result.remote.isArray = true;
		
		ko.utils.extend(result, ko.observableArray["fn"]);
		
		ko.exportProperty(result, "remove", result.remove);
		ko.exportProperty(result, "removeAll", result.removeAll);
		ko.exportProperty(result, "destroy", result.destroy);
		ko.exportProperty(result, "destroyAll", result.destroyAll);
		ko.exportProperty(result, "indexOf", result.indexOf);
		ko.exportProperty(result, "replace", result.replace);
		
		return result;
	}
	
	ko.exportSymbol("ko.remoteable", ko.remoteable);
	ko.exportSymbol("ko.isRemoteable", ko.isRemoteable);	
	ko.exportSymbol("ko.remoteSetup", ko.remoteSetup);	
	ko.exportSymbol("ko.remoteObservable", ko.remoteObservable);
	ko.exportSymbol("ko.remoteObservableArray", ko.remoteObservableArray);
	
})(window);

