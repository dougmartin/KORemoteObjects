<?php
	header("Content-Type: application/json");
	
	function get($name, $defaultValue = null) {
		return isset($_REQUEST[$name]) ? trim($_REQUEST[$name]) : $defaultValue;
	}
	
	function success($data) {
		echo json_encode(array(
			"success" => true,
			"data" => $data
		));
		exit;
	}
	
	function error($message) {
		echo json_encode(array(
			"success" => false,
			"error" => $message
		));
		exit;
	}	
	
	function loadDatabase() {
	
		if (file_exists("demodata.php")) {
			$users = include "demodata.php";
		}
		else {
			$users = array(
				array(
					"id" => 1,
					"name" => "Doug Martin",
					"email" => "doug@example.com",
					"favoriteColor" => "blue"
				),
				array(
					"id" => 2,
					"name" => "Jeff Martin",
					"email" => "jeff@example.com",
					"favoriteColor" => "red"
				),
				array(
					"id" => 3,
					"name" => "Greg Martin",
					"email" => "greg@example.com",
					"favoriteColor" => "green"
				),
			);
			
			saveDatabase($users);
		}
		
		return $users;
	}
	
	function saveDatabase($users) {
		if (@file_put_contents("demodata.php", "<?php return " . var_export($users, true) . ";") === false) {
			error("Unable to save the database");
		}
	}
	
	function findUserIndexById($users, $id) {
		
		for ($i = 0, $count = count($users); $i < $count; $i++) {
			if ($users[$i]["id"] == $id) {
				return $i;
			}
		}
		return false;
	}
	
	function validateUserParams() {
		foreach (array("name", "email", "favoriteColor") as $param) {
			if (strlen(get($param)) == 0) {
				error("Missing {$param} parameter");
			}
		}
	}
	
	$action = get("action");
	if ($action === null) {
		error("Missing action parameter");
	}
	if (!in_array($action, array("load", "create", "update", "destroy"))) {
		error("Unknown action parameter: {$action}");
	}
	
	$type = get("type");
	if ($type === null) {
		error("Missing type parameter");
	}
	if (!in_array($type, array("user", "userList"))) {
		error("Unknown type parameter: {$type}");
	}
	
	$users = loadDatabase();
	
	$userList = array();
	foreach ($users as $user) {
		$userList[] = array(
			"id" => $user["id"],
			"name" => $user["name"],		
		);
	}

	$id = get("id");
	
	switch ($action) {
		case "load":
			switch ($type) {
				case "userList":
					success($userList);
					break;
					
				case "user":
					if ($id) {
						$index = findUserIndexById($users, $id);
						if ($index !== false) {
							success($users[$index]);
						}
						error("Unable to find user with id of {$id}");
					}
					error("Missing id parameter");
					break;
			}
			break;
			
		case "create":
			if ($type == "user") {
				validateUserParams();
				
				$id = 0;
				foreach ($users as $user) {
					$id = max($id, $user["id"]);
				}
				$id++;
				
				$user = array("id" => $id, "name" => get("name"), "email" => get("email"), "favoriteColor" => get("favoriteColor"));
				$users[] = $user;
				saveDatabase($users);
				success($user);
			}
			break;
			
		case "update":
			if ($type == "user") {
				if ($id) {
					$index = findUserIndexById($users, $id);
					if ($index !== false) {
						validateUserParams();
						
						$users[$index]["name"] = get("name");
						$users[$index]["email"] = get("email");
						$users[$index]["favoriteColor"] = get("favoriteColor");
						saveDatabase($users);
						success($users[$index]);
					}
					error("Unable to find user with id of {$id}");
				}
				error("Missing id parameter");
			}
			break;
			
		case "destroy":
			if ($type == "user") {
				if ($id) {
					$index = findUserIndexById($users, $id);
					if ($index !== false) {
						array_splice($users, $index, 1);
						saveDatabase($users);
						success(array());
					}
					error("Unable to find user with id of {$id}");
				}
				error("Missing id parameter");
			}
			break;
	}
	
	error("Unhandled demo call: {$action} {$type}");
	
