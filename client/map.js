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
    radius: 3,
    fillColor: '#00008B',
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
                var tripData = tripMarkers[tripId];
                updateTripPosition(tripData);
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

        loadColors();
    },
    error: function(jqXHR, textStatus, errorThrown) {
        debugger;
    }
});

var colorsData = {};
function loadColors() {
    $.ajax({
        dataType: 'json',
        url: 'colors.json',
        success: function(data) {
            $(data).each(function(idx, row) {
                let vbz_line = row.Linie_NR_DIVA;
                colorsData[vbz_line] = row;
            });

            timer.init();
        },
        error: function(jqXHR, textStatus, errorThrown) {
            debugger;
        }
    });
}
 
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

function updateTripPosition(tripData) {
    var coords = [0, 0];
    var tripStatus = 'UNKNOWN';
    var trip = tripData.trip;
    var delaySeconds = 0;

    for (var idx = 0; idx < trip.segments.length; idx++) {

        var segment = trip.segments[idx];

        var vbzStopA = vbzStops[segment.from_stop_code];
        var vbzStopB = vbzStops[segment.to_stop_code];

        var depA = segment.from_time_actual;

        var depB;
        var isLastStop = idx === (trip.segments.length - 1);
        var nextSegment;
        if (isLastStop) {
            depB = segment.to_time_actual;
        } else {
            nextSegment = trip.segments[idx + 1];
            depB = nextSegment.from_time_actual;
        }

        if ((depA <= timeNow) && (timeNow <= depB)) {
            var arrB = segment.to_time_actual;

            if (timeNow <= arrB) {
                // the vehicle is between A and B
                tripStatus = 'Between ' + segment.from_stop_code + ' and ' + segment.to_stop_code;

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

                delaySeconds = segment.to_time_actual - segment.to_time_expected;

                coords = [coordY, coordX];
            } else {
                // the vehicle is in B
                var stopBCoords = vbzStopB.geometry.coordinates;
                coords = [stopBCoords[1], stopBCoords[0]];

                tripStatus = 'In ' + segment.to_stop_code;
                
                if (nextSegment) {
                    delaySeconds = nextSegment.from_time_actual - nextSegment.from_time_expected;    
                }
            }

            break;
        }
    }

    tripData.marker.setLatLng(coords);

    var popup = tripData.marker.getPopup();

    var html = '<b>Line:</b> ' + tripData.trip.vbzLine;
    html += '<br/><b>Status:</b> ' + tripStatus;
    html += '<br/><b>Delay:</b> ' + formatDelayMSS(delaySeconds);

    popup.setContent(html);
}

// http://stackoverflow.com/questions/3733227/javascript-seconds-to-minutes-and-seconds
function formatDelayMSS(s){
    return(s-(s%=60))/60+(9<s?':':':0')+s;
}


function parseTrips(data) {
    function parseTrip(tripData) {
        var vbzLine = tripData.vbzLine;

        var markerOptions = {
            radius: 10,
            fillColor: '#CACACA',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 1.0,
            title: vbzLine
        };

        var colorData = colorsData[vbzLine];
        var tooltipClassName = 'vbzMarker';
        if (colorData) {
            markerOptions.fillColor = '#' + colorData.route_color;
            markerOptions.color = '#' + colorData.route_text_color;

            let isBlackText = colorData.route_text_color === '000000';
            if (isBlackText) {
                tooltipClassName = 'vbzMarker vbzMarkerBlack';    
            }
        }

        var marker = L.circleMarker([0, 0], markerOptions);
        marker.addTo(map).bindTooltip(vbzLine, {
            permanent: true,
            className: tooltipClassName,
            direction: 'center'
        });
        marker.bindPopup(function(){
            return 'init...';   
        }, {
            autoPan: false,
            offset: [0, -5]
        });

        tripMarkers[tripData.trip_id] = {
            marker: marker,
            trip: tripData
        };
    }

    for (var tripData of data) {
        if (params.lineFilter && tripData.vbzLine !== params.lineFilter) {
            continue;
        }

        var tripId = tripData.trip_id;
        
        if (tripMarkers[tripId]) {
            continue;
        }

        parseTrip(tripData);
    }
}


