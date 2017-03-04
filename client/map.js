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

// params.time = 35010;
var params = {};

if (window.location.hash) {
    window.location.hash.substring(1).split('&').forEach(i => {
        var param = i.split('=');
        params[param[0]] = param[1];
    })
}

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

        $.ajax({
            dataType: "json",
            url: "routes?date=2016-07-01&now=" + params.time,
            success: loadTrips,
            error: function(jqXHR, textStatus, errorThrown) {
                debugger;
            }
        });
    },
    error: function(jqXHR, textStatus, errorThrown) {
        debugger;
    }
});

var timer = (function(){
    var tickMs = 1000; // we'll decrease it to 100 later

    function init() {
        setInterval(function(){
            console.log(timeNow);
            timeNow += tickMs / 1000;
        }, tickMs);
    }

    return {
        init: init
    }
})();

timer.init();

function loadTrips(data) {
    // data = data.slice(0, 1);
    for (var trip of data) {
        if (params.lineFilter && trip.zvv_line != params.lineFilter) {
            continue;
        }
        for (var idx = 0; idx < trip.segments.length; idx++) {

            var segment = trip.segments[idx];

            var vbzStopA = vbz_stops[segment.from_stop_code];
            var vbzStopB = vbz_stops[segment.to_stop_code];

            var isLastStop = idx === (trip.segments.length - 1);

            var depA = segment.from_time_actual;
            var depB;
            if (isLastStop) {
                depB = segment.to_time_actual;
            } else {
                var nextSegment = trip.segments[idx + 1];
                depB = nextSegment.from_time_actual;
            }

            if ((params.time >= depA) && (params.time <= depB)) {
                var arrB = segment.to_time_actual;
                let zvv_line = trip.zvv_line;
                if (params.time <= arrB) {
                    var timeAC = params.time - depA;
                    var timeAB = segment.to_time_actual - depA;
                    var ratio = timeAC / timeAB;
                    var coordX = vbzStopA.geometry.coordinates[0] + (vbzStopB.geometry.coordinates[0] - vbzStopA.geometry.coordinates[0]) * ratio;
                    var coordY = vbzStopA.geometry.coordinates[1] + (vbzStopB.geometry.coordinates[1] - vbzStopA.geometry.coordinates[1]) * ratio;

                    var featureCoords = [coordY, coordX];
                    var marker = L.marker(featureCoords).addTo(map).bindPopup(function(){
                        return zvv_line;
                    });
                } else {
                    var featureCoords = vbzStopB.geometry.coordinates;
                    var marker = L.marker([featureCoords[1], featureCoords[0]]).addTo(map).bindPopup(function(){
                        return zvv_line;
                    });
                }
            }
        }
            
    }
}


