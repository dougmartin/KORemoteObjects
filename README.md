# KORemoteObjects #
 
A remote object extension to Knockout.js 1.3+
 
## Introduction ##
 
KORemoteObjects adds a remoting interface to Knockout.js in the form of two new functions: ko.remoteObservable and ko.remoteObservableArray.
These two functions mirror the ko.observable and ko.observableArray functions with the addition of a new "remote" namespace.  The remote
namespace exposes a simple CRUD (create, retrieve, update, delete) interface to allow you to sync objects between the browser and the server.
 
## Sample Usage ##

    // declare the remote object
    var user = ko.remoteObservable("user");

	// create a new user
	user.create({name: "Fred", email: "fred@example.com"}, function (response) {
		// ... optionally process the response here.  At this point user() is the value of the processed response and can
		// be referenced just like a ko.observable.
	});

	// load the user id of 10
    user.load({id: 10}, function (response) {
		// ... 
    });
	
	// update an existing user
	user.update({email: "fred2@example.com"}, function (response) {
		// ... 
    });
	
	// destroy a user (delete is a reserved word in Javascript)
	user.destroy({id: 20}, function response) {
		// ... 
    });
	
## Sample Usage with Model ##

	function user(userInfo) {
		this.id = userInfo.id;
		this.name = userInfo.name;
		this.email = userInfo.email;
		// note: you may want to use jQuery.extend(this, userInfo) to just copy all the properties at once
	}

    // declare the remote object with a model
    var user = ko.remoteObservable("user", {
		model: user
	});
	
If you specify a model it is "newed" using the processed response from the server like this:

	var model = new user(processedResponse);
	
## Sample Array Usage with Model ##

    var users = ko.remoteObservableArray("user", {
		model: user
	});
	
	users.load({page: 1});
	
Each element of the array will be a "newed" user model.  All the ko.observableArray functions are also defined and 
users() can be accessed in the templates:

	<ul data-bind="foreach: users">
		<li data-bind="text: name" />
	</ul>

## Configuration ##
 
To avoid a lot of boilerplate code KORemoteObjects adopts the convention over configuration philosopy.  However all the convention
can be overridden either at the global level or under specific calls to ko.remoteObject or ko.remoteObservableArray.

Here is a list of all the conventions and how they can be overridden for the ko.remoteObservable("user", options) sample where "user" is
referenced using the type variable and options is an object of options.

### Remote endpoint ###

Convention: action + type.substr(0, 1).toUpperCase() + type.substr(1)
Example: createUser, loadUser, updateUser, destroyUser

Configuration: 

	ko.remoteObservable("user", {
		getUrl: function (action, type, method) {
			return "/api/" + type + "/" + (action === "create" ? "add" : action);
		}
	};
	
	// or globally...
	
	ko.remoteSetup({
		getUrl: function (action, type, method) {
			return "/api/" + type + "/" + (action === "create" ? "add" : action);
		}
	});

Example: /api/user/add, /apu/user/load, /api/user/update, /api/user/destroy

### Remote method ###

Convention: POST for create/update/destroy and GET for load

Configuration Option 1:

	ko.remoteObservable("user", {
		useRestMethods: true
	});
	
	// or globally...
	
	ko.remoteSetup({
		useRestMethods: true
	});

this converts the methods to POST for create, PUT for update, DELETE for destroy and GET for load

Configuration Option 2:

	ko.remoteObservable("user", {
		getMethod: function (action, type, method) {
			// make everything gets for giggles
			return "GET";
		}
	};
	
	// or globally...
	
	ko.remoteSetup({
		getMethod: function (action, type, method) {
			// same as above
		}
	});
	
### Parsing request data for server calls ###

Convention: no parsing, data is passed directly to the server

Configuration:

	ko.remoteObservable("user", {
		parseRequestData: function (action, type, data) {
			// server expects email parameter as "theEmail"
			if (data.hasOwnProperty("email")) {
				data.theEmail = data.email;
				delete data.email;
			}
			return data;
		}
	};
	
	// or globally...
	
	ko.remoteSetup({
		parseRequestData: function (action, type, data) {
			// same as above
		}
	});
	
### Parsing response data from server calls ###

Convention: convert responses to the following form

	{
		success: true,
		data: *server response*
	}
	
Configuration:

	ko.remoteObservable("user", {
		parseResult: function (action, type, result) {
			// client expects email parameter as "email"
			if (result.hasOwnProperty("theEmail")) {
				result.email = result.theEmail;
				delete result.theEmail;
			}
			return result;
		}
	};
	
	// or globally...
	
	ko.remoteSetup({
		parseResult: function (action, type, data) {
			// same as above
		}
	});	

### Ajax settings ###
	
Convention: KORemoteObjects uses jQuery.ajax() for server communications.

Configuration:

You can override the default jQuery.ajax options

	ko.remoteObservable("user", {
		ajax: {
			// any setting here from the jQuery.ajax settings page
		}
	};
	
	// or globally...
	
	ko.remoteSetup({
		ajax: {
			// same as above
		}
	});	 
	
## Built in support for form posts ##

There is built in support for form posts by simply passing a form variable for the data instead of a bare object.

	<form name="user">
		<p>
			<label for="name">Name</label>
			<input type="text" name="name" />
		</p>
		<p>
			<label for="name">Email</label>
			<input type="text" name="email" />
		</p>
		<input type="submit" data-bind="click: function () { user.create(document.forms.user); }">
	</form>
	
## Built in support for form validation using jQuery Validate ##

If you include jquery.validate.js KORemoteObjects will automatically add validation on form submits.  The validation
rules are set when the remote observable is defined.  The syntax for validations can be found in the jQuery
validation site.

	user = ko.remoteObservable("user", {
		"validate": {
			"rules":  {
				"name": "required",
				"email": {
					"required": true,
					"email": true
				}
			}
		}
	});

## Built in logging ##

For ease of development a debug log is maintained exposed using the "remoteObservableDebugLog" binding.  To display
the log at the bottom of your page you would do this:

	<div class="debugLog" data-bind="remoteObservableDebugLog: ko.remoteObservable.debugLog"></div>
	
## Built in cacheing ##

The library maintains a cache of the last load.  The cache is used internally and is exposed with the following function:

	user.loadIfNotCached({id: 10});
	
This allows you to put loads in your code without having to add conditional code to check if it is already loaded which
reduces server load.  The cache key is built from the .load() call data, not the response.


## Required Libraries ##

jQuery (1.6.2 or above)
knockout.js (1.3 or above)
	
## Supporting Libraries ##

jquery.validate.js
 
## Demo ##
 
A demo is available in the respository that shows CRUD operations on a list of users.  The data is backed using a simple 
text file.
