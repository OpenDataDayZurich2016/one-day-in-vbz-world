/* global L:false, $:false */
var map = L.map('mapid').setView([47.38, 8.54], 14);

L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoidmFzaWxlIiwiYSI6IjA1emRjS0EifQ.taY320EMCSP-gLIrZQKb7A', {
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
        '<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
        'Imagery © <a href="http://mapbox.com">Mapbox</a>',
    id: 'mapbox.streets'
}).addTo(map);

var tripMarkers = {};
var vbzStops = {};
var vbzMarkerOptions = {
    radius: 4,
    fillColor: '#ff7800',
    color: '#000',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.8
};

var params = {};
var timeNow = 35010; // default is 09:44
var lastLoadTime;

function parseParams() {
    if (window.location.hash) {
        window.location.hash.substring(1).split('&').forEach(i => {
            var param = i.split('=');
            params[param[0]] = param[1];
        });
    }

    if (params.time) {
        let isNumeric = !isNaN(parseFloat(params.time)) && isFinite(params.time);
        if (isNumeric) {
            timeNow = parseInt(params.time);
        } else {
            let hms = params.time.split(':');
            if (hms.length === 2) {
                hms.push(0);
            }

            timeNow = (+hms[0]) * 60 * 60 + (+hms[1]) * 60 + (+hms[2]); 
        }
    }
}

var timer = (function(){
    var tickMs = 100; // we'll decrease it to 100 later

    function init() {
        parseParams();
        loadTrips();

        setInterval(function(){
            // TODO - add timeNow in a UI element

            // when minute changed (i.e. from 09:40 to 09:41)
            // then call again loadTrips

            let timeMultiply = 10;

            timeNow += tickMs / 1000 * timeMultiply;
            let elapsedTimeSinceLastLoad = timeNow - lastLoadTime;
            if (elapsedTimeSinceLastLoad > 60) {
                loadTrips();
            }

            // Main update loop
            for (let tripId in tripMarkers) {
                var data = tripMarkers[tripId];
                var latlng = computeTripPosition(data.trip);
                data.marker.setLatLng(latlng);
            }

            let hms = new Date(1000 * timeNow).toISOString().substr(11, 5);
            document.getElementById('current-time').innerText = hms;
            document.getElementById('time-slider').value = timeNow;
        }, tickMs);
    }

    return {
        init: init
    }
})();

window.addEventListener('hashchange', function () {
    parseParams();
    loadTrips();
}, false);
document.getElementById('time-slider').oninput = function() {
    timeNow = parseInt(this.value);
    loadTrips();
};

$.ajax({
    dataType: 'json',
    url: 'stops.geojson',
    success: function(data) {
        $(data.features).each(function(key, jsonFeature) {
            var stopCode = jsonFeature.properties.stop_code;

            L.geoJSON(jsonFeature, {
                pointToLayer: function (f, latlng) {
                    return L.circleMarker(latlng, vbzMarkerOptions);
                }
            }).bindPopup(function(node){
                var p = node.feature.properties;
                return p.stop_code + '<br/>' + p.Name1;
            }).addTo(map);

            vbzStops[stopCode] = jsonFeature;
        });

        timer.init();
    },
    error: function(jqXHR, textStatus, errorThrown) {
        debugger;
    }
});

function loadTrips() {
    lastLoadTime = timeNow;
    $.ajax({
        dataType: 'json',
        url: 'http://localhost:8080/routes?date=2016-07-01&now=' + timeNow,
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

        var vbzStopA = vbzStops[segment.from_stop_code];
        var vbzStopB = vbzStops[segment.to_stop_code];

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
                var coordX, coordY;
                if (!isNaN(ratio)) {
                    coordX = vbzStopA.geometry.coordinates[0] + (vbzStopB.geometry.coordinates[0] - vbzStopA.geometry.coordinates[0]) * ratio;
                    coordY = vbzStopA.geometry.coordinates[1] + (vbzStopB.geometry.coordinates[1] - vbzStopA.geometry.coordinates[1]) * ratio;
                } else {
                    // VASILE: Please check if this makes sense to you
                    // On some points, the ratio ends up being NaN so we
                    // take stop A as fallback
                    coordX = vbzStopA.geometry.coordinates[0];
                    coordY = vbzStopA.geometry.coordinates[1];
                }

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
    for (var trip of data) {
        if (params.lineFilter && trip.vbzLine !== params.lineFilter) {
            continue;
        }

        var tripId = trip.trip_id;
        
        if (tripMarkers[tripId]) {
            continue;
        }

        var marker = L.marker([0, 0]);
        marker.addTo(map).bindPopup(function(){
            let vbzLine = trip.vbzLine;
            return vbzLine;
        });

        tripMarkers[trip.trip_id] = {
            marker: marker,
            trip: trip
        };
    }
}
