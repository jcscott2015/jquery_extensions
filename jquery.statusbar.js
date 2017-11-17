/**
 * jquery.statusBar jQuery Plug-in
 *
 * Copyright 2015 Novatel Wireless (http://www.nvtl.com/)
 *
 * Date:   2015-03-25
 * Rev:    1.6.14 (Jordan)
 * Author: John C. Scott <joscott@nvtl.com>
 */
(function ($) {
	var statusPolling = null;
	var autoStopTimeout = null;
	var o = {};
	var statusElements = {};
	var pollingElements = {};
	var errorCount = 0;
	var VERSION = "1.6.14 (Jordan)";

	// These defaults can be overwritten when initializing the object.
	var defaults = {
			url : "/srv/status",
			groupClass : "status clearfix",
			battNumOfBars : 10,
			lowBatteryThreshold : 5, /* number represents low battery percentage */
			pollingRate : 5000,
			errorMax : 2
		};

	// Global variables for storing states
	var noService = false;
	var searching = false;
	var simError = false;
	var simLocked = false;
	var noSim = false;
	var roaming = false;

	/**
	 * Define statusBar extension jQuery plugin
	 * @param {String} method
	 *
	 * Methods are called like this.
	 *
	 * $.statusBar("destroy");
	 *
	 * The method parameter can be followed by any number of arguments.
	 *
	 * If the provided method is unrecognized and the argument is an object,
	 * then the methods.init function will be called and the object passed to it.
	 * Arguments are passed to the methods.init function like this:
	 *
	 * $.statusBar({
	 * 	 url : "/srv/status",
	 *   timeout : 5000,
	 *   statusBars : { ... }
	 * });
	 */
	$.statusBar = function(method) {
		checkForEnumLibrary();
		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else if ( typeof method === "object" || !method) {
			return methods.init.apply(this, arguments);
		} else {
			$.error("Method " + method + " does not exist in jQuery.statusBar");
		}
	};

	/**
	 * Define statusBar function jQuery plugin
	 * @param {String} method
	 *
	 * Methods are called like this.
	 *
	 * $("#header").statusBar("attach");
	 *
	 * The method parameter can be followed by any number of arguments.
	 */
	$.fn.statusBar = function(method) {
		var input = this;
		var args = arguments;
		checkForEnumLibrary();
		return input.each(function() {
			if (fnMethods[method]) {
				return fnMethods[method].apply(input, Array.prototype.slice.call(args, 1));
			} else {
				$.error("Method " + method + " does not exist in jQuery.fn.statusBar");
			}
		});
	};

	// Public Methods

	/**
	 * Methods for $.statusBar only
	 */
	var methods = {
		version : function() {
			return VERSION;
		},

		/**
		 * methods.init
		 *
		 * Creates status bar object(s) globally as part of the jQuery object,
		 * and configures the status bar object(s) using known data from REST service.
		 *
		 * Options should be written like this:
		 * {
		 * 	url : "/srv/status",
		 * 	structure : {
		 *		headerStatusBar : {
		 *			name : "headerStatusBar",
		 *			structure : {
		 *				statusBar_battery_grp : {
		 *					statusBar_battery : ["statusBarBatteryChargingSource", "statusBarBatteryChargingState", "statusBarBatteryPercent", "statusBarBatteryDetection"]
		 *				},
		 *				statusBar_connected_devices_grp : {
		 *					statusBar_connected_devices : ["statusBarWiFiClientListSize", "statusBarWiFiEnabled"]
		 *				},
		 *				statusBar_gps_grp : {
		 *					statusBar_gps : ["statusBarGpsStatus"]
		 *				},
		 *				statusBar_roamingFemto_grp : {
		 *					statusBar_femto_roam : ["statusBarFemtoCellStatus", "statusBarRoaming"]
		 *				},
		 *				statusBar_activity_grp : {
		 *					statusBar_activity : ["statusBarTrafficStatus"]
		 *				},
		 *				statusBar_tech_grp : {
		 *					statusBar_tech : ["statusBarTechnology", "statusBarTechnologyText"]
		 *				},
		 *				statusBar_sim_grp : {
		 *					statusBar_sim : ["statusBarSimStatus", "statusBarSimCarrierBlockedStatus"]
		 *				},
		 *				statusBar_network_grp : {
		 *					statusBar_rssi : ["statusBarSignalBars"],
		 *					statusBar_network : ["statusBarNetwork", "statusBarNetworkID", "statusBarConnectionState"]
		 *				}
		 *			}
		 *		},
		 *		mobileStatusBar : {
		 *			name : "mobileStatusBar",
		 *			structure : {
		 *				mobile_statusBar_battery_grp : {
		 *					mobile_statusBar_battery : ["statusBarBatteryChargingSource", "statusBarBatteryChargingState", "statusBarBatteryPercent", "statusBarBatteryDetection"]
		 *				},
		 *				mobile_statusBar_connected_devices_grp : {
		 *					mobile_statusBar_connected_devices : ["statusBarWiFiClientListSize", "statusBarWiFiEnabled"]
		 *				},
		 *				mobile_statusBar_gps_grp : {
		 *					mobile_statusBar_gps : ["statusBarGpsStatus"]
		 *				},
		 *				mobile_statusBar_activity_grp : {
		 *					mobile_statusBar_activity : ["statusBarTrafficStatus"]
		 *				},
		 *				mobile_statusBar_tech_grp : {
		 *					mobile_statusBar_tech : ["statusBarTechnology", "statusBarTechnologyText"]
		 *				},
		 *				mobile_statusBar_network_grp : {
		 *					mobile_statusBar_rssi : ["statusBarSignalBars"],
		 *					mobile_statusBar_network : ["statusBarNetwork", "statusBarNetworkID"],
		 * 					mobile_statusBar_sim : ["statusBarSimStatus", "statusBarSimCarrierBlockedStatus", "statusBarConnectionState"],
		 * 					mobile_statusBar_femto_roam : ["mobileStatusBarFemtoCellStatus", "mobileStatusBarRoaming"]
		 *				}
		 *			}
		 *		}
		 * 	},
		 * 	simNoSimText						: '<tmpl_var _("webui", "status_bar_sim_status_no_sim_text")>',
		 * 	simPinLockedText				: '<tmpl_var _("webui", "status_bar_sim_status_pin_locked_text")>',
		 * 	simPukLockedText				: '<tmpl_var _("webui", "status_bar_sim_status_puk_locked_text")>',
		 * 	simInvalidText					: '<tmpl_var _("webui", "status_bar_sim_status_invalid_sim_text")>',
		 * 	simErrorText						: '<tmpl_var _("webui", "status_bar_sim_status_sim_error_text")>',
		 *	wanNoServiceText				: '<tmpl_var _("webui", "status_bar_no_service_text")>',
		 *	wanSearchingText				: '<tmpl_var _("webui", "status_bar_searching_text")>',
		 *	connectedDevicesMaxText	: '<tmpl_var _("webui", "status_bar_connected_devices_max")>',
		 *	simMmCode2Text					: '<tmpl_var _("webui", "status_bar_sim_mm_code2_error_text")>',
		 *	simMmCode3Text					: '<tmpl_var _("webui", "status_bar_sim_mm_code3_error_text")>',
		 *	simMmCode6Text					: '<tmpl_var _("webui", "status_bar_sim_mm_code6_error_text")>',
		 * 	wanTech4g								: '<tmpl_var _("webui", "common_status_bar_wan_tech_4g_text")>',
		 * 	wanTech4glte						: '<tmpl_var _("webui", "common_status_bar_wan_tech_4glte_text")>',
		 * 	wanTechGsm							: '<tmpl_var _("webui", "common_status_bar_wan_tech_gsm_text")>',
		 * 	wanTech3g								: '<tmpl_var _("webui", "common_status_bar_wan_tech_3g_text")>',
		 * 	wanTechHspa							: '<tmpl_var _("webui", "common_status_bar_wan_tech_hspa_text")>',
		 *	successCallback					: statusBarSuccess,
		 *	errorCallback						: statusBarError,
		 *	timeoutCallback					: statusBarError
		 * }
		 *
		 * The statusBars object contains objects that make each status bar.
		 * More than one status bar element can be defined on a page.
		 * The "statusBars" and SIM texts options are required.
		 * Keys in each status bar structure object will be ids in the unordered list construct.
		 * If there are multiple status bar elements, all these keys must be unique.
		 * The order of the status bar structure object reflects the order of the statuses in the web UI.
		 * The list values are known keys in the system service JSON data for the desired status.
		 */
		init : function(options) {
			o = $.extend(true, defaults, options);

			// Make the status bar elements; collect in statusElements.
			// Add status bars to pollingElements object for AJAX polling.
			if((o.statusBars) && (!$.isEmptyObject(o.statusBars))) {
				$.each(o.statusBars, function (sBar) {
					var name = o.statusBars[sBar].name;
					statusElements[name] = $(makeStatusBar(o.statusBars[sBar].structure));
					pollingElements[name] = name;
				});
				getStatusBarData();
			} else {
				$.error("No status bar(s) defined.");
			}
		},

		/**
		 * methods.destroy
		 * @param {String} statusName (status bar name; optional)
		 *
		 * Remove status bar object from the DOM
		 * and destroy the object.
		 *
		 * $.statusBar("destroy", "headerStatusBar");
		 */
		destroy : function(statusName) {
			if ( (typeof statusName !== "undefined") && (statusName !== "") ) {
				// Stop polling on this status bar.
				methods.stop(statusName);
				// Remove status bar from DOM.
				statusElements[statusName].remove();
				// Delete status bar from statusElements object.
				delete statusElements[statusName];
			} else {
				// Stop polling.
				methods.stop();
				$.each(o.statusBars, function (sBar) {
					var name = o.statusBars[sBar].name;
					// Remove status bar from DOM.
					statusElements[name].remove();
					// Delete status bar from pollingElements object.
					delete statusElements[name];
					// Delete status bar from statusElements object.
					delete pollingElements[name];
				});
			}
		},

		/**
		 * methods.start
		 * @param {String} statusName (status bar name; optional)
		 *
		 * Start or restart ajax polling.
		 *
		 * $.statusBar("start", "headerStatusBar");
		 */
		start : function(statusName) {
			if ( (typeof statusName !== "undefined") && (statusName !== "") ) {
				if (validateStatusName(statusName)) {
					// Add status bar to pollingElements object to start polling this status bar.
					pollingElements[statusName] = statusName;
				}
			} else {
				getStatusBarData();
			}
		},

		/**
		 * methods.autoStop
		 * @param {Int} delay (milliseconds)
		 * @param {String} statusName (status bar name; optional)
		 *
		 * Stop ajax polling after a period of milliseconds.
		 *
		 * $.statusBar("autoStop", (600 * 1000), "headerStatusBar");
		 */
		autoStop : function(delay, statusName) {
			if ( (typeof statusName !== "undefined") && (statusName !== "") ) {
				autoStopTimeout = setTimeout(function() { methods.stop(statusName); }, delay);
			} else {
				autoStopTimeout = setTimeout(methods.stop, delay);
			}
		},

		/**
		 * methods.stop
		 * @param {String} statusName (status bar name; optional)
		 *
		 * Stop ajax polling.
		 *
		 * $.statusBar("stop", "headerStatusBar");
		 */
		stop : function(statusName) {
			if ( (typeof statusName !== "undefined") && (statusName !== "") ) {
				// Delete status bar from pollingElements object to stop polling this status bar.
				delete pollingElements[statusName];
			} else {
				clearTimeout(statusPolling);
			}
		},

		/**
		 * methods.refresh
		 * @param {String} statusName (status bar name; optional)
		 *
		 * Refreshes status by stopping and then starting ajax polling.
		 *
		 * $.statusBar("refresh", "headerStatusBar");
		 */
		refresh : function(statusName) {
			if ( (typeof statusName !== "undefined") && (statusName !== "") ) {
				methods.stop(statusName);
				methods.start(statusName);
			} else {
				methods.stop();
				methods.start();
			}
		}
	};

	/**
	 * Methods for $.fn.statusBar only
	 */
	var fnMethods = {
		/**
		 * fnMethods.attach
		 *
		 * Attach status bar object to the page.
		 *
		 * $("#header").statusBar("attach", "headerStatusBar");
		 */
		attach : function(status) {
			if(statusElements[status]) {
				$(this).empty().append(statusElements[status]);
			} else {
				$.error("The jQuery.statusBar has not been properly initialized.");
			}
		}
	};

	// Private Methods

	/**
	 * Status bar class assignment logic goes here.
	 * These functions will likely change from one product to another.
	 *
	 * Call all updateAllStatus methods for each defined status bar:
	 *
	 *	$.each(pollingElements, function (sBar, sBarName) {
	 *		$.each(updateAllStatus, function (i) {
	 *			return updateAllStatus[i].call(this, data.statusData, sBarName);
	 *		});
	 *	});
	 *
	 * The process order must be: airplane mode, SIM status,
	 * 	Carrier/Service status, and then battery, gps, etc.
	 */
	var updateAllStatus = {
		/**
		 * SIM - Not Present - Displays error message. Hides RSSI, Technology
		 * SIM - Invalid SIM - Displays error message. Hides RSSI, Technology
		 * SIM - PIN Lock Enabled - Displays error message. Hides RSSI, Technology
		 * SIM - PUK Locked State - Displays error message. Hides RSSI, Technology
		 */
		updateSimStatus : function (json, statusName) {
			var statusObj = selectDomItem(statusName, "statusBarSimStatus");
			if (statusObj) {
				var desiredKeys = getStatusBarItem(statusName, "keys", ["statusBarSimStatus", "statusBarSimCarrierBlockedStatus"]);
				var className = "sim_ready";
				var simErrorTxt = "";
				if ( ($.inArray("statusBarSimStatus", desiredKeys) > -1)
					&& (checkStatusItem(json.statusBarSimStatus))
					&& ((json.statusBarSimStatus !== $.uiEnums.SIMSTATUS_READY)
						|| (json.statusBarSimStatus !== $.uiEnums.SIMSTATUS_UNLOCKED)) ) {
					// SIM is NOT READY or LOCKED... so there is a SIM Error
					className = "sim_" + convertToClassName(json.statusBarSimStatus);
					switch (json.statusBarSimStatus) {
						case $.uiEnums.SIMSTATUS_NOT_FOUND:
							simErrorTxt = o.simNoSimText;
							noSim = true;
							break;
						case $.uiEnums.SIMSTATUS_PIN_LOCKED:
							simErrorTxt = o.simPinLockedText;
							simLocked = true;
							break;
						case $.uiEnums.SIMSTATUS_PUK_LOCKED:
							simErrorTxt = o.simPukLockedText;
							simLocked = true;
							break;
						case $.uiEnums.SIMSTATUS_NOT_SUPPORTED:
							simErrorTxt = o.simInvalidText;
							simError = true;
							break;
						case $.uiEnums.SIMSTATUS_ERROR:
							if (checkStatusItem(json.statusBarSimCarrierBlockedStatus)
								&& (json.statusBarSimCarrierBlockedStatus === $.uiEnums.BOOLTYPE_NUMERIC_TRUE)) {
								className = "sim_invalid";
								simErrorTxt = o.simInvalidText;
							} else {
								className = "sim_error";
								simErrorTxt = o.simErrorText;
							}
							simError = true;
							break;
					}
				}

				if (simErrorTxt !== "") {
					// Then hide other status.
					hideShowGroup(statusName, "hide",
						["statusBarFemtoCellStatus",
						"statusBarRoaming",
						"statusBarTrafficStatus",
						"statusBarTechnology"]);

					hideShowItems(statusName, "hide",
						["mobileStatusBarFemtoCellStatus",
						"mobileStatusBarRoaming"]);

					// show mobile sim/wwan status
					statusObj.parent("li").show();
					statusObj.removeClass().addClass("text " + className).html(simErrorTxt);

					// We've got a SIM Error, so there's nothing else to do, except update connected devices, the carrier name, RSSIs, and the battery.
					updateAllStatus.updateBatteryStatus(json, statusName);
					updateAllStatus.updateTetheredUsbStatus(json, statusName);
					updateAllStatus.updateSignalStrengthStatus(json, statusName);
					updateAllStatus.updateNetworkStatus(json, statusName);

					// Then, we're outta updateAllStatus()!
					return false;
				} else {
					// reset global states
					simError = false;
					simLocked = false;
					noSim = false;

					// hide sim/wwan status
					statusObj.removeClass().html("").parents("ul").hide();

					// hide mobile sim/wwan status
					statusObj.removeClass().html("").parent("li").hide();

					hideShowGroup(statusName, "show",
						["statusBarFemtoCellStatus",
						"statusBarRoaming",
						"statusBarTrafficStatus",
						"statusBarTechnology"]);
				}
			}
		},

		/**
		 * SIM - MM Code #2 Present (SIM not Provisioned) - Displays error message. Hides RSSI, Network Name, Technology
		 * SIM - MM Code #3 Present (SIM not allowed) - Displays error message. Hides RSSI, Network Name, Technology
		 * SIM - MM Code #6 Present (Device not allowed) - Displays error message. Hides RSSI, Network Name, Technology
		 */
		updateSimMMCodeStatus: function (json, statusName) {
			var statusObj = selectDomItem(statusName, "statusBarSimMMCode");
			if (statusObj) {
				var simMMCodeText = "";
				if (checkStatusItem(json.statusBarSimMMCode)) {
					switch (json.statusBarSimMMCode) {
						case "2":
							simMMCodeText = o.simMmCode2Text;
							simError = true;
							break;
						case "3":
							simMMCodeText = o.simMmCode3Text;
							simError = true;
							break;
						case "6":
							simMMCodeText = o.simMmCode6Text;
							simError = true;
							break;
					}
				}

				if (simMMCodeText !== "") {
					// Show sim/wwan status
					statusObj.parent("li").show();
					statusObj.removeClass().addClass("text nopadding sim_mm_code_error").html(simMMCodeText);

					// Then hide other status.
					hideShowGroup(statusName, "hide",
						["statusBarFemtoCellStatus",
						"statusBarRoaming",
						"statusBarTrafficStatus",
						"statusBarTechnology"]);

					hideShowItems(statusName, "hide",
						["statusBarNetwork",
						"statusBarSignalBars",
						"mobileStatusBarFemtoCellStatus",
						"mobileStatusBarRoaming"]);

					// We've got a SIM Error, so there's nothing else to do, except update the battery and GPS.
					updateAllStatus.updateBatteryStatus(json, statusName);
					updateAllStatus.updateGpsStatus(json, statusName);

					// Then, we're outta updateAllStatus()!
					return false;
				} else {
					// reset global states
					simError = false;
					simLocked = false;
					noSim = false;

					// hide sim/wwan status
					statusObj.removeClass().html("").parents("ul").hide();

					// hide mobile sim/wwan status
					statusObj.removeClass().html("").parent("li").hide();

					hideShowGroup(statusName, "show",
						["statusBarFemtoCellStatus",
						"statusBarRoaming",
						"statusBarTrafficStatus",
						"statusBarTechnology"]);

					hideShowItems(statusName, "show",
						["statusBarNetwork",
						"statusBarSignalBars"]);
				}
			}
		},

		/**
		 * WAN Tech State status
		 *
		 * Other states the future
		 * WANSTATE_INITIALIZING : "Initializing",
		 * WANSTATE_SEARCHING : "Searching",
		 * WANSTATE_IDLE : "Ready",
		 * WANSTATE_CONNECTING : "Connecting",
		 * WANSTATE_CONNECTED : "Connected",
		 * WANSTATE_DORMANT : "Dormant",
		 * WANSTATE_DISCONNECTING : "Disconnecting",
		 * WANSTATE_ACTIVATING : "Activating",
		 * WANSTATE_NOSERVICE : "No Service",
		 * WANSTATE_UNACTIVATED : "Unactivated",
		 *
		 * If statusBarConnectionState is any of these, replace network name with the connection state:
		 * WANSTATE_SEARCHING = "Searching"
		 * WANSTATE_NOSERVICE = "No Service"
		 * WANSTATE_UNACTIVATED = "Unactivated"
		 *
		 * and hide RSSI and technology status
		 */
		updateWanTechStatus: function (json, statusName) {
			var statusObj = selectDomItem(statusName, "statusBarConnectionState");
			if (statusObj) {
				var desiredKeys = getStatusBarItem(statusName, "keys", "statusBarConnectionState");
				var wanTechText = "";
				if (($.inArray("statusBarConnectionState", desiredKeys) > -1) && (checkStatusItem(json.statusBarConnectionState))) {
					switch (json.statusBarConnectionState) {
						case $.uiEnums.WANSTATE_NOSERVICE:
							wanTechText = o.wanNoServiceText;
							noService = true;
							break;
						case $.uiEnums.WANSTATE_SEARCHING:
							wanTechText = o.wanSearchingText;
							searching = true;
							break;
					}
				}

				if (wanTechText !== "") {
					hideShowGroup(statusName, "hide",
						["statusBarFemtoCellStatus",
						"statusBarRoaming",
						"statusBarTrafficStatus",
						"statusBarTechnology"]);

					hideShowItems(statusName, "hide",
						["mobileStatusBarFemtoCellStatus",
						"mobileStatusBarRoaming"]);

					// Houston, we have a WAN Tech error.
					// show mobile sim/wwan status
					statusObj.parent("li").show();
					statusObj.removeClass().addClass("text nopadding wan_tech_error").html(wanTechText);

					// We've got a WAN Tech Error, so there's nothing else to do, except update connected devices, the carrier name, RSSIs, and the battery.
					updateAllStatus.updateBatteryStatus(json, statusName);
					updateAllStatus.updateTetheredUsbStatus(json, statusName);
					updateAllStatus.updateSignalStrengthStatus(json, statusName);
					updateAllStatus.updateNetworkStatus(json, statusName);

					// Then, we're outta updateAllStatus()!
					return false;
				} else {
					// reset global states
					noService = false;
					searching = false;

					// hide sim/wwan status
					statusObj.removeClass().html("").parents("ul").hide();

					// hide mobile sim/wwan status
					statusObj.removeClass().html("").parent("li").hide();

					hideShowGroup(statusName, "show",
						["statusBarFemtoCellStatus",
						"statusBarRoaming",
						"statusBarTrafficStatus",
						"statusBarTechnology"]);
				}
			}
		},

		/**
		 * Battery icon - While not charging - Displays "Charge Level"
		 * Battery icon - While connected to wall charger & charging - Displays "AC Charging Icon with Charge Level"
		 * Battery icon - While connected to USB charger & charging - Displays "USB Charging Icon with Charge Level"
		 * Battery icon - While charge level drops during test - Displays updated "Charge level"
		 * Battery icon - When charging starts - Icon auto refreshed to "Charging Icon with Charge Level"
		 * Battery icon - When charging stops - Icon remains "Charging Icon with Charge Level", if connected.
		 * Battery icon - When charging stops - Icon auto refreshed from "Charging Icon with Charge Level" to "Charge Level Icon", if disconnected.
		 * Battery icon - When no battery present - Empty battery with "X" inside.
		 * Battery icon - When invalid battery - Empty battery with "?" inside.
		 */
		updateBatteryStatus : function(json, statusName) {
			var keys = ["statusBarBatteryChargingSource", "statusBarBatteryChargingState", "statusBarBatteryPercent", "statusBarBatteryDetection"];
			var statusObj = selectDomItem(statusName, keys);
			if (statusObj) {
				var desiredKeys = getStatusBarItem(statusName, "keys", keys);
				var className = "batt_none";
				if ( ($.inArray("statusBarBatteryDetection", desiredKeys) > -1)
					&& checkStatusItem(json.statusBarBatteryDetection) ) {
					if (json.statusBarBatteryDetection === $.uiEnums.BATTERY_DETECTION_PRESENT) {
						var chargingSrc = "";
						// Determine charging source
						if ( (($.inArray("statusBarBatteryChargingSource", desiredKeys) > -1)
							&& checkStatusItem(json.statusBarBatteryChargingSource)
							&& (json.statusBarBatteryChargingSource !== $.uiEnums.CHARGINGSOURCE_NONE))
							&& (($.inArray("statusBarBatteryChargingState", desiredKeys) > -1)
							&& checkStatusItem(json.statusBarBatteryChargingState)
							&& (json.statusBarBatteryChargingState === $.uiEnums.BOOLTYPE_BOOLEAN_TRUE)) ) {
							chargingSrc = convertToClassName(json.statusBarBatteryChargingSource) + "_";
						}

						// Determine charging level
						if ( ($.inArray("statusBarBatteryPercent", desiredKeys) > -1)
							&& checkStatusItem(json.statusBarBatteryPercent)
							&& (json.statusBarBatteryPercent > -1) ) {
							var per = json.statusBarBatteryPercent;
							if (per <= o.lowBatteryThreshold) {
								className = "batt_" + chargingSrc + "low";
							} else {
								var barSize = 100/o.battNumOfBars;
								var bars = Math.round(per/barSize);
								className = "batt_" + chargingSrc + bars;
							}
						}
					} else if (json.statusBarBatteryDetection === $.uiEnums.BATTERY_DETECTION_INVALID) {
						var className = "batt_invalid";
					}
				}
				statusObj.removeClass().addClass(className);
			}
		},

		/**
		 * Connected Devices/Tethered USB
		 *
		 * Count is combined count for all connection types.
		 * Count will be "Max" whenever both the Primary and Guest network reach their maximum count.
		 *
		 * If Wi-Fi is not enabled, we can assume that the device is USB tethered -- otherwise the web UI could be seen.
		 * The USB Tethered icon is shown, then, in place of the Connected Devices icon.
		 */
		/*
		updateConnectedDevicesStatus : function(json, statusName) {
			var statusObj = selectDomItem(statusName, ["statusBarWiFiClientListSize", "statusBarWiFiEnabled"]);
			if (statusObj) {
				if ( checkStatusItem(json.statusBarWiFiEnabled) && (json.statusBarWiFiEnabled > 0) ) {
					var maxPrimaryClientListSize = parseInt(json.statusBarMaxPrimaryClientListSize) || 0;
					var maxGuestClientListSize = parseInt(json.statusBarMaxGuestClientListSize) || 0;
					var clientListSize = parseInt(json.statusBarWiFiClientListSize) || 0;
					var primaryClientListSize = parseInt(json.statusBarPrimaryClientListSize) || 0;
					var guestClientListSize = parseInt(json.statusBarGuestClientListSize) || 0;
					if ( ((maxPrimaryClientListSize > 0) || (maxGuestClientListSize > 0)) && (clientListSize > 0) ) {
						var counts = "";
						var totalAllowedClients = maxPrimaryClientListSize;
						var totalConnectedClients = primaryClientListSize;
						if ( checkStatusItem(json.statusGuestWifiEnabled) && (json.statusGuestWifiEnabled > 0) ) {
							totalAllowedClients = totalAllowedClients + maxGuestClientListSize;
							totalConnectedClients = totalConnectedClients + guestClientListSize;
						}

						if (totalConnectedClients >= totalAllowedClients) {
							counts = o.connectedDevicesMaxText; // Max
						} else {
							counts = clientListSize;
						}
						statusObj.empty().removeClass().append('<span class="counts">' + counts + '</span>');
					} else {
						hideShowGroup(statusName, "hide", ["statusBarWiFiClientListSize", "statusBarWiFiEnabled"]);
					}
				} else {
					// Wi-Fi disabled.
					statusObj.empty().removeClass().addClass("tethered_usb");
				}
			}
		},
		*/

		/**
		 * Tethered USB
		 *
		 * If Wi-Fi is not enabled, we can assume that the device is USB tethered -- otherwise the web UI could be seen.
		 * The USB Tethered icon is shown in the status bar.
		 */
		updateTetheredUsbStatus : function(json, statusName) {
			var statusObj = selectDomItem(statusName, ["statusBarWiFiClientListSize", "statusBarWiFiEnabled"]);
			if (statusObj) {
				if ( checkStatusItem(json.statusBarWiFiEnabled) && (json.statusBarWiFiEnabled == 0) ) {
					statusObj.empty().removeClass().addClass("tethered_usb");
				} else {
					statusObj.removeClass().parents("ul").hide();
				}
			}
		},

		/**
		 * GPS Icon - While GPS is disabled - GPS Icon is hidden
		 * GPS Icon - While GPS Search is in progress (Enable GPS) - Displays "GPS Searching Icon"
		 * GPS Icon - While GPS Fix is available (Search complete) - Displays "GPS Fix Available Icon"
		 * GPS Icon - GPS Search failed - GPS Icon is hidden
		 */
		updateGpsStatus: function (json, statusName) {
			var statusObj = selectDomItem(statusName, "statusBarGpsStatus");
			if (statusObj) {
				if (checkStatusItem(json.statusBarGpsStatus)) {
					if ((json.statusBarGpsStatus === $.uiEnums.GPSSTATUS_SEARCHING) || (json.statusBarGpsStatus === $.uiEnums.GPSSTATUS_FIXED)) {
						statusObj.parents("ul").show();
						statusObj.removeClass().addClass("gps_" + convertToClassName(json.statusBarGpsStatus));
					} else {
						statusObj.removeClass().parents("ul").hide();
					}
				} else {
					statusObj.removeClass().parents("ul").hide();
				}
			}
		},

		/**
		 * When roaming, show roaming icon for Domestic, International, or Flash.
		 * If femto on, show femto icon instead.
		 */
		updateFemtoRoamStatus: function (json, statusName) {
			var statusObj = selectDomItem(statusName, ["statusBarFemtoCellStatus", "statusBarRoaming"]);
			if (statusObj) {
				var roamClass = json.statusBarRoaming;
				var className = "femto_roam_none";
				roaming = false;

				// Roaming - Domestic, International, and Flash
				if (checkStatusItem(json.statusBarRoaming) && (roamClass !== $.uiEnums.ROAMNONE)) {
					className = "roam_" + convertToClassName(roamClass);
					roaming = true;
				}
				// Set roaming first if there is roaming. Followed by overriding with femto if there is femto.
				if (checkStatusItem(json.statusBarFemtoCellStatus) && (json.statusBarFemtoCellStatus === $.uiEnums.BOOLTYPE_NUMERIC_TRUE)) {
					className = "femto_on";
					roaming = true;
				}

				statusObj.removeClass().addClass(className);
			}
		},

		/* mobile roaming/femto status */
		updateMobileFemtoRoamStatus: function (json, statusName) {
			var statusObj = selectDomItem(statusName, ["mobileStatusBarFemtoCellStatus", "mobileStatusBarRoaming"]);
			if (statusObj) {
				statusObj.parent("li").show();
				var roamClass = json.statusBarRoaming;
				roaming = false;

				// Roaming - Domestic, International, and Flash
				if (checkStatusItem(json.statusBarRoaming) && (roamClass !== $.uiEnums.ROAMNONE)) {
					statusObj.removeClass().addClass("roam_" + convertToClassName(roamClass));
					roaming = true;
				}
				// Set roaming first if there is roaming. Followed by overriding with femto if there is femto.
				if (checkStatusItem(json.statusBarFemtoCellStatus) && (json.statusBarFemtoCellStatus === $.uiEnums.BOOLTYPE_NUMERIC_TRUE)) {
					statusObj.removeClass().addClass("femto_on");
					roaming = true;
				}

				statusObj.removeClass().addClass("femto_roam_none");
				statusObj.parent("li").hide();
			}
		},

		/* network name */
		updateNetworkStatus : function(json, statusName) {
			var statusObj = selectDomItem(statusName, ["statusBarNetwork", "statusBarNetworkID"]);
			if (statusObj) {
				var className = "text network_name";
				var networkName = "";
				if ( noService || searching || simError || simLocked || noSim ) {
					statusObj.removeClass().text("");
					hideShowItems(statusName, "hide", ["statusBarNetwork"]);
				} else {
					if (checkStatusItem(json.statusBarNetwork)) {
						networkName = json.statusBarNetwork;
					}
					statusObj.parent("li").show();
					statusObj.removeClass().addClass(className).text(networkName);
				}
			}
		},

		/* rssi and no SIM error icons */
		updateSignalStrengthStatus: function (json, statusName) {
			var statusObj = selectDomItem(statusName, "statusBarSignalBars");
			if (statusObj) {
				if ( noService || searching || simError || simLocked || noSim ) {
					hideShowItems(statusName, "hide", ["statusBarSignalBars"]);
				} else if(checkStatusItem(json.statusBarSignalBars)) {
					statusObj.removeClass().addClass("rssi_" + json.statusBarSignalBars);
				}
			}
		},

		/**
		 * Service Status - Displays RSSI, Network Name, and Technology string.
		 *
		 * Technology strings:
		 * 	LTE -> LTE Icon (WANTECH_LTE)
		 * 	LTE+ -> LTE+ Icon (WANTECH_LTE_CA)
		 * 	HSPA+ DC -> H+ (WANTECH_HSPA_PLUS_DC)
		 * 	HSPA+ -> H+ (WANTECH_HSPA_PLUS)
		 * 	HSDPA -> H+ (WANTECH_HSDPA)
		 * 	HSUPA -> H+ (WANTECH_HSUPA)
		 * 	UMTS -> H+ (WANTECH_UMTS)
		 * 	EDGE -> GSM (WANTECH_EDGE)
		 * 	GPRS -> GSM (WANTECH_GPRS)
		 */
		updateTechStatus: function (json, statusName) {
			var statusObj = selectDomItem(statusName, "statusBarTechnology");
			if (statusObj) {
				var showTech = false;
				var className = "tech_none";
				// Use PRI supplied technology strings, if provided.
				var techText = ( checkStatusItem(json.statusBarTechnologyText) ) ? json.statusBarTechnologyText : "";
				if ( checkStatusItem(json.statusBarTechnology) ) {
					var techStr = json.statusBarTechnology;
					if ( (techStr === $.uiEnums.WANTECH_LTE)
						|| (techStr === $.uiEnums.WANTECH_LTE_CA) ) {
						techText = "";
						showTech = true;
					} else if ( (techStr === $.uiEnums.WANTECH_HSDPA)
						|| (techStr === $.uiEnums.WANTECH_HSUPA)
						|| (techStr === $.uiEnums.WANTECH_HSPA_PLUS)
						|| (techStr === $.uiEnums.WANTECH_HSPA_PLUS_DC)
						|| (techStr === $.uiEnums.WANTECH_UMTS) ) {
						if (techText == "") techText = o.wanTech4g;
						showTech = true;
					} else if ( (techStr === $.uiEnums.WANTECH_EDGE)
						|| (techStr === $.uiEnums.WANTECH_GPRS) ) {
						if (techText == "") techText = o.wanTechGsm;
						showTech = true;
					}

					className = "tech_" + convertToClassName(techStr);
					if (techText != "") className = "text " + className;
				}

				// Display text or icon, or hide if no supported technologies are used.
				if (showTech) {
					statusObj.removeClass().addClass(className).html(techText);
				} else {
					statusObj.html("");
					hideShowItems(statusName, "hide", ["statusBarTechnology"]);
				}
			}
		},

		/* traffic activity arrows */
		updateTrafficStatus : function(json, statusName) {
			var statusObj = selectDomItem(statusName, "statusBarTrafficStatus");
			if (statusObj) {
				var className = "activity_none";
				if (checkStatusItem(json.statusBarTrafficStatus)) {
					className = "activity_" + convertToClassName(json.statusBarTrafficStatus);
				}
				statusObj.removeClass().addClass(className);
			}
		}
	};

	/**
	 * checkForEnumLibrary
	 */
	var checkForEnumLibrary = function() {
		if (!$.uiEnums) {
			$.error("Can't find jQuery.uiEnums object.");
		}
	};

	/**
	 * checkStatusItem
	 * @param {String} key
	 * @return {Boolean}
	 */
	var checkStatusItem = function(key) {
		if ( (typeof key !== "undefined") && (key !== "") ) {
			return true;
		}
		return false;
	};

	/**
	 * validateStatusName
	 * @param {String} statusName (status bar name)
	 * @return {Boolean}
	 *
	 * The status bar should already exist as an object.
	 */
	var validateStatusName = function(statusName) {
		var valid = false;
		$.each(statusElements, function (sBar) {
			if (statusElements[sBar] === statusName) {
				valid = true;
				return false; // break out of loop
			} else {
				$.error('Status bar named, "' + statusName + '", has not been instantiated.');
			}
		});

		return valid;
	};

	/**
	 * convertToClassName
	 * @param {String} classStr
	 * @return {String}
	 */
	var convertToClassName = function(classStr) {
		return classStr.toLowerCase().replace(/ /g, "_");
	};

	/**
	 * makeStatusBar
	 * @param {Object} structure
	 * @return {String}
	 */
	var makeStatusBar = function(structure) {
		var statusBarHtml = "";
		$.each(structure, function (grp, status) {
			statusBarHtml += '<ul id="' + grp + '" class="' + o.groupClass + '" style="display:none;">';
			$.each(status, function (item) {
				statusBarHtml += '<li id="item_' + item + '"><span id="' + item + '" style="display:none;"></span></li>';
			});
			statusBarHtml += '</ul>';
		});
		return statusBarHtml;
	};

	/**
	 * hideShowGroup
	 * @param {String} statusName (status bar name)
	 * @param {String} action ("hide" or "show")
	 * @param {Array} keys
	 */
	var hideShowGroup = function (statusName, action, keys) {
		$.each(o.statusBars[statusName].structure, function (grp, status) {
			$.each(status, function (statusId, jsonKeys) {
				$.each(keys, function (k) {
					if ($.inArray(keys[k], jsonKeys) > -1) {
						var grpObj = $("#" + grp);
						if (action === "hide") grpObj.hide();
						if (action === "show") {
							// if all the children are hidden, don't bother to show the group.
							if (grpObj.children(":hidden").length != grpObj.children().length) {
						 		grpObj.show();
							}
						}
					}
				});
			});
		});
	};

	/**
	 * hideShowItems
	 * @param {String} statusName (status bar name)
	 * @param {String} action ("hide" or "show")
	 * @param {Array} keys
	 */
	var hideShowItems = function (statusName, action, keys) {
		$.each(o.statusBars[statusName].structure, function (grp, status) {
			$.each(status, function (statusId, jsonKeys) {
				$.each(keys, function (k) {
					if ($.inArray(keys[k], jsonKeys) > -1) {
						var grpObj = $("#" + grp);
						var statusObj = $("#" + statusId);
						if (action === "hide") {
							statusObj.removeClass().hide();
							statusObj.parent("li").hide();
							// if all the children are hidden, hide the group.
							if (grpObj.children(":hidden").length == grpObj.children().length) {
								grpObj.hide();
							}
						}
						if (action === "show") {
							grpObj.show();
							statusObj.parent("li").show();
							statusObj.show();
						}
					}
				});
			});
		});
	};

	/**
	 * selectDomItem
	 * @param {String} statusName (status bar name)
	 * @param {String or Array} keys
	 * @return {Object}
	 *
	 * If the DOM element was found, and the DOM element and its parent group are hidden,
	 * the DOM element is returned as a jQuery object and the DOM element and its parent are shown.
	 */
	var selectDomItem = function (statusName, keys) {
		var statusObj = null;
		var nKeys = [];
		var statusId = getStatusBarItem(statusName, "id", keys, true);
		if (statusId !== "") {
			if ($("#" + statusId).length > 0) {
				statusObj = $("#" + statusId);
			} else {
				statusObj = statusElements[statusName].find("#" + statusId);
			}

			if ($.isArray(keys)) {
				nKeys = keys;
			} else {
				nKeys[nKeys.length] = keys;
			}

			hideShowItems(statusName, "show", nKeys);
		}

		return statusObj;
	};

	/**
	 * getStatusBarItem
	 * @param {String} statusName (status bar name)
	 * @param {String} action ("id" or "keys")
	 * @param {String or Array} keyToMatch
	 * @param {Boolean} arrayMatch - exact array match, but order can be different.
	 * @return {String or Array}
	 */
	var getStatusBarItem = function (statusName, action, keyToMatch, arrayMatch) {
		var matchArray = (typeof arrayMatch !== "undefined") ? arrayMatch : false;
		var id = "";
		var keys = [];

		$.each(o.statusBars[statusName].structure, function(grp, status) {
			$.each(status, function(item, jsonKeys) {
				if ($.isArray(keyToMatch)) {
					if (matchArray) {
						if ( ($(keyToMatch).not(jsonKeys).length == 0) && ($(jsonKeys).not(keyToMatch).length == 0) ) {
							id = item;
							keys = jsonKeys;
						}
					} else {
						$.each(keyToMatch, function(k) {
							if ($.inArray(keyToMatch[k], jsonKeys) > -1) {
								id = item;
								keys = jsonKeys;
							}
						});
					}
				} else {
					if ($.inArray(keyToMatch, jsonKeys) > -1) {
						id = item;
						keys = jsonKeys;
					}
				}
			});
		});

		if (action === "id") return id;
		if (action === "keys") return keys;
	};

	var getStatusBarDataError = function() {
		errorCount++;
		if (errorCount > o.errorMax) {
			errorCount = 0;
			//more than errorMax errors in succession to be treated as unreachable
			if (o.errorCallback) o.errorCallback();
		}
	};

	/**
	 * getStatusBarData
	 * @param {Object} jsonObj (optional)
	 *
	 * Get data from a passed json object, or if no passed
	 * json object, get json data from a REST call.
	 */
	var getStatusBarData = function () {
		if(!updateAllStatus) {
			$.error("Status bar updating methods are not defined.");
			return false;
		}

		$.ajax({
			url : o.url,
			type : "GET",
			dataType : "json",
			timeout : o.pollingRate * 2,
			cache : false,
			success : function(data, textStatus, xhr) {
				// If no network connected, success event still occurs.
				// We need to implicitly see an xhr.status greater than 0 to know we've actually made contact.
				if ( (xhr.readyState == 4 ) && (xhr.status > 0) ) {
					errorCount = 0; //reset error counter

					// We'll be updating any status bar listed in pollingElements.
					$.each(pollingElements, function (sBar, sBarName) {
						$.each(updateAllStatus, function (i) {
							return updateAllStatus[i].call(this, data.statusData, sBarName);
						});
					});

					if (o.successCallback) o.successCallback();
				} else {
					// ... otherwise we'll consider unable to connect an error case.
					getStatusBarDataError();
				}
			},
			error : function(xhr, textStatus, errorThrown) {
				if (textStatus == "error") {
					getStatusBarDataError();
				} else if (textStatus == "timeout") {
					//treat timeout case as a possible MiFi unreachable cases, and not all
					//other errors ( like parser errors etc )
					if (o.timeoutCallback) o.timeoutCallback();
				}
			},
			complete : function(xhr, textStatus) {
				if (o.completeCallback) o.completeCallback();
				if (o.pollingRate) {
					statusPolling = setTimeout(getStatusBarData, o.pollingRate);
				} else {
					// long polling
					getStatusBarData();
				}
			}
		});
	};
})(jQuery);
