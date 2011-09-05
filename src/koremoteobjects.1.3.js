(function (window, undefined) {
	var remoteSettings = {
		"getUrl": undefined,
		"useRestMethods": undefined,
		"ajax": {
			"dataType": undefined,
			"context": undefined		
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
				"data": undefined,
				"useRestMethods": undefined,
				"ajax": {
					"dataType": undefined,
					"context": undefined
				}
			}, options);
			
		ko.utils.extend(this, ko.remoteable["fn"]);
		
		ko.exportProperty(this, "type", type);
		ko.exportProperty(this, "settings", settings);
		ko.exportProperty(this, "state", state);
		ko.exportProperty(this, "error", error);
		ko.exportProperty(this, "isArray", isArray);
		ko.exportProperty(this, "hasData", hasData);
		
		ko.exportProperty(this, "init", this.init);
		ko.exportProperty(this, "clear", this.clear);
		ko.exportProperty(this, "load", this.load);
		ko.exportProperty(this, "create", this.create);
		ko.exportProperty(this, "createFromForm", this.createFromForm);
		ko.exportProperty(this, "update", this.update);
		ko.exportProperty(this, "updateFromForm", this.updateFromForm);
		ko.exportProperty(this, "save", this.save);
		ko.exportProperty(this, "saveFromForm", this.saveFromForm);
		ko.exportProperty(this, "destroy", this.destroy);
	}
	
	ko.remoteable["fn"] = {
		
		_ajax: function (action, data, method, onSuccess, onError, onComplete) {
			var startState = this.state(),
				successes, errors, completes;
		
			function addEnding(word, ending) {
				var rootWord = word.substr(word.length - 1) == "e" ? word.substr(0, word.length - 1) : word;
				return rootWord + ending;
			}
			
			function getAjaxCallbacks(action, successes, errors, completes) {
				
				function applyForEachCallback(callbacks, args) {
					for (var i = 0, j = callbacks.length; i < j; i++) {
						if (callbacks[i]) {
							callbacks[i].apply(this, args);
						}
					}
				}		
				
				return {
					success: function (data, textStatus, jqXHR) {
						applyForEachCallback.call(this, successes, [parseResult.call(this, data), data, textStatus, jqXHR, action, this.type]);
					},
					error: function (jqXHR, textStatus, errorThrown) {
						applyForEachCallback.call(this, errors, [jqXHR, textStatus, errorThrown, action, this.type]);
					},
					complete: function (jqXHR, textStatus) {
						applyForEachCallback.call(this, completes, [jqXHR, textStatus, action, this.type]);
					}			
				};
			}
			
			function getUrl(action, type, method) {
				if (this.settings.getUrl) {
					return this.settings.getUrl(action, type, method);
				}
				if (remoteSettings.getUrl) {
					return remoteSettings.getUrl(action, type, method);
				}
				return action + type.substr(0, 1).toUpperCase() + type.substr(1);
			}
			
			function getMethod(action, type, method) {
				if (this.settings.getMethod) {
					return this.settings.getMethod(action, type, method);
				}
				if (remoteSettings.getMethod) {
					return remoteSettings.getMethod(action, type, method);
				}
				return method;
			}

			function parseRequestData(action, type, data) {
				if (this.settings.parseRequestData) {
					return this.settings.parseRequestData(action, type, data);
				}
				if (remoteSettings.parseRequestData) {
					return remoteSettings.parseRequestData(action, type, data);
				}
				return data;
			}

			function parseResult(result) {
				if (this.settings.parseResult) {
					return settings.parseResult(action, type, result);
				}
				if (remoteSettings.parseResult) {
					return remoteSettings.parseResult(action, type, result);
				}
				return result;
			}
			
			function setData(action, type, data) {
				if (this.settings.setData) {
					return this.settings.setData(action, type, data);
				}
				if (remoteSettings.setData) {
					return remoteSettings.setData(action, type, data);
				}
				return false;
			}
			
			successes = [function (result, textStatus, jqXHR) {
				var defaultError, parsedResult = parseResult.call(this, result);
				
				if (parsedResult && parsedResult.success) {
					if (!setData.call(this, action, this.type, parsedResult.data || {})) {
						this(parsedResult.data || {});
					}
					this.state(addEnding(action, "ed"));
					this.error(undefined);
				}
				else {
					this.state(startState);
					defaultError = "Error " + addEnding(action, "ing") + " " + this.type;
					this.error(parsedResult ? parsedResult.error || defaultError : defaultError);
				}
			}, onSuccess, this.settings.ajax.success, remoteSettings.ajax.success];
			
			errors = [function (jqXHR, textStatus, errorThrown) {
				this.state(startState);
				this.error(errorThrown);
			}, onError, this.settings.ajax.error, remoteSettings.ajax.error];
			
			completes = [onComplete, this.settings.ajax.complete, remoteSettings.ajax.complete];
			
			this.state(addEnding(action, "ing"));
			
			jQuery.ajax(jQuery.extend({}, remoteSettings.ajax, this.settings.ajax, getAjaxCallbacks("create", successes, errors, completes), {
				url: getUrl.call(this, action, this.type, method),
				type: getMethod.call(this, action, this.type, method),
				data: parseRequestData.call(this, action, this.type, data),
				context: this
			}));		
		},
		
		_useRestMethods: function (ifRest, ifNotRest) {
			// the settings flag overrides and remote settings flag, but they are both boolean so we have to do the dance
			return (this.settings.useRestMethods === true) || ((this.settings.useRestMethods === undefined) && (remoteSettings.useRestMethods === true)) ? ifRest : ifNotRest;
		},
		
		_getFormValidator: function (form) {
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

			validationSettings = getValidationSettings(this.settings, formName);
			if (validationSettings !== false) {
				validationSettings = getValidationSettings(remoteSettings, formName);
			}
			return validationSettings !== false ? $form.validate(validationSettings || {}) : false;
		},
		
		// adapted from http://v3.javascriptmvc.com/jquery/dist/jquery.formparams.js
		_getFormData: function (form, convert) {
			var radioCheck = /radio|checkbox/i,
				keyBreaker = /[^\[\]]+/g,
				numberMatcher = /^[\-+]?[0-9]*\.?[0-9]+([eE][\-+]?[0-9]+)?$/,
				data = {},
				current, validator;

			function isNumber( value ) {
				if ( typeof value == "number" ) {
					return true;
				}
				if ( typeof value != "string" ) {
					return false;
				}
				return value.match(numberMatcher);
			};
			
			form = form || this.settings.form;
			if (!form) {
				return false;
			}
			
			if (form.nodeName.toLowerCase() !== "form" || !form.elements ) {
				throw "Non form element passed to getFormData()";
			}
			
			convert = convert === undefined ? true : convert;
			
			// do optional validation 
			if (form && jQuery.fn.validate) {
				validator = this._getFormValidator(form);
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

		
		//
		// exported functions
		//
		
		init: function (data) {
			this.state("init");
			this(data);
		},
		
		clear: function () {
			this.state("init");
			this({});
		},
		
		load: function (data, onSuccess, onError, onComplete) {
			this._ajax("load", data, "GET", onSuccess, onError, onComplete);
		},
		
		create: function (data, onSuccess, onError, onComplete) {
			if (data === undefined) {
				data = this._getFormData();
			}
			if (data !== false) {
				this._ajax("create", jQuery.extend({}, this(), data), "POST", onSuccess, onError, onComplete);
			}
		},
		
		createFromForm: function (form, onSuccess, onError, onComplete) {
			var data = this._getFormData(form);
			if (data !== false) {
				this.create(data, onSuccess, onError, onComplete);
			}
		},
		
		update: function (data, onSuccess, onError, onComplete) {
			if (data === undefined) {
				data = this._getFormData();
			}
			if (data !== false) {
				this._ajax("update", jQuery.extend({}, this(), data), this._useRestMethods("PUT", "POST"), onSuccess, onError, onComplete);
			}
		},
		
		updateFromForm: function (form, onSuccess, onError, onComplete) {
			var data = this._getFormData(form);
			if (data !== false) {
				this.update(data, onSuccess, onError, onComplete);
			}
		},
		
		save: function (data, onSuccess, onError, onComplete) {
			if (data === undefined) {
				data = this._getFormData();
			}
			if (data !== false) {
				this.state() == "init" ? this.create.call(this, data, onSuccess, onError, onComplete) : this.update.call(this, data, onSuccess, onError, onComplete);
			}
		},
		
		saveFromForm: function (form, onSuccess, onError, onComplete) {
			var data = this._getFormData(form);
			if (data !== false) {
				this.save(data, onSuccess, onError, onComplete);
			}
		},
		
		destroy: function (data, onSuccess, onError, onComplete) {
			this._ajax("destroy", data, this._useRestMethods("DELETE", "POST"), onSuccess, onError, onComplete);
		},
		
		resetForm: function (form) {
			var validator;
			
			if (form && jQuery.fn.validate) {
				validator = this._getFormValidator(form);
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
	
	// the exact same as ko.observableArray except for the first two lines, I feel bad for all this copy pasta but result is buried in observableArray
	ko.remoteObservableArray = function (type, options) {
		var result = new ko.remoteObservable(type, options, []);
		result.isArray = true;
		
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

