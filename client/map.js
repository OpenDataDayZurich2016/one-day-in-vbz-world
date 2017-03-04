var map = L.map('mapid').setView([47.38, 8.54], 14);

L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoidmFzaWxlIiwiYSI6IjA1emRjS0EifQ.taY320EMCSP-gLIrZQKb7A', {
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
        '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
        'Imagery © <a href="http://mapbox.com">Mapbox</a>',
    id: 'mapbox.streets'
}).addTo(map);

var vbz_stops = {};

var vbz_marker_options = {
    radius: 4,
    fillColor: "#ff7800",
    color: "#000",
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};

var params = {};

if (window.location.hash) {
    window.location.hash.substring(1).split('&').forEach(i => {
        var param = i.split('=');
        params[param[0]] = param[1];
    });
}

var timeNow = params.time || 35010; // default is 09:44
var timer = (function(){
    var tickMs = 100; // we'll decrease it to 100 later

    function init() {
        loadTrips();

        setInterval(function(){
            // TODO - add timeNow in a UI element

            // when minute changed (i.e. from 09:40 to 09:41)
            // then call again loadTrips

            let timeMultiply = 10;

            timeNow += tickMs / 1000 * timeMultiply;
        }, tickMs);
    }

    return {
        init: init
    }
})();


$.ajax({
    dataType: "json",
    url: "stops.geojson",
    success: function(data) {
        $(data.features).each(function(key, jsonFeature) {
            var stop_code = jsonFeature.properties.stop_code;

            L.geoJSON(jsonFeature, {
                pointToLayer: function (f, latlng) {
                    return L.circleMarker(latlng, vbz_marker_options);
                }
            }).bindPopup(function(node){
                var p = node.feature.properties;
                return p.stop_code + '<br/>' + p.Name1;
            }).addTo(map);

            vbz_stops[stop_code] = jsonFeature;
        });

        timer.init();
    },
    error: function(jqXHR, textStatus, errorThrown) {
        debugger;
    }
});

var tripMarkers = {};


function loadTrips() {
    $.ajax({
        dataType: "json",
        url: "routes?date=2016-07-01&now=" + timeNow,
        success: parseTrips,
        error: function(jqXHR, textStatus, errorThrown) {
            debugger;
        }
    });
}

function computeTripPosition(trip) {
    var coords = [0, 0];

    for (var idx = 0; idx < trip.segments.length; idx++) {

        var segment = trip.segments[idx];

        var vbzStopA = vbz_stops[segment.from_stop_code];
        var vbzStopB = vbz_stops[segment.to_stop_code];

        var depA = segment.from_time_actual;

        var depB;
        var isLastStop = idx === (trip.segments.length - 1);
        if (isLastStop) {
            depB = segment.to_time_actual;
        } else {
            var nextSegment = trip.segments[idx + 1];
            depB = nextSegment.from_time_actual;
        }

        if ((depA <= timeNow) && (timeNow <= depB)) {
            var arrB = segment.to_time_actual;

            if (timeNow <= arrB) {
                // the vehicle is between A and B
                var timeAC = timeNow - depA;
                var timeAB = segment.to_time_actual - depA;
                var ratio = timeAC / timeAB;
                var coordX = vbzStopA.geometry.coordinates[0] + (vbzStopB.geometry.coordinates[0] - vbzStopA.geometry.coordinates[0]) * ratio;
                var coordY = vbzStopA.geometry.coordinates[1] + (vbzStopB.geometry.coordinates[1] - vbzStopA.geometry.coordinates[1]) * ratio;

                coords = [coordY, coordX];
            } else {
                // the vehicle is in B
                var stopBCoords = vbzStopB.geometry.coordinates;
                coords = [stopBCoords[1], stopBCoords[0]];
            }

            break;
        }
    }

    return coords;
}

function parseTrips(data) {
    // data = data.slice(0, 1);
    function initMarker(trip) {
        var marker = L.marker([0, 0]);
        marker.addTo(map).bindPopup(function(){
            let zvv_line = trip.zvv_line;
            return zvv_line;
        });
        
        setInterval(function(){
            var latlng = computeTripPosition(trip);
            marker.setLatLng(latlng);
        }, 100);

        tripMarkers[tripId] = marker;
    }

    for (var trip of data) {
        if (params.lineFilter && trip.zvv_line != params.lineFilter) {
            continue;
        }

        var tripId = trip.trip_id;
        
        if (tripMarkers[tripId]) {
            continue;
        }

        initMarker(trip);
    }
}


