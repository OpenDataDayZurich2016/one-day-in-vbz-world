// var fs = require('fs');
var fetch = require('node-fetch');
var app = require('express')();
var cors = require('cors');
var server = require('http').Server(app);

// Run the webserver on port 8080
server.listen(8080);

async function loadDataFile(url) {
    let response = await fetch(url);
    return await response.json();
}

var routes = {
    cache: {},
    get: async function(dateString, from, to) {
        if (!(dateString in this.cache)) {
            this.cache[dateString] = await loadDataFile(`https://github.com/OpenDataDayZurich2016/one-day-in-vbz-world/raw/master/api/data/routes_data_${dateString}.json`);
        }

        if (!(dateString in this.cache)) {
            console.error(`Missing data: ${dateString}`);
            return null;
        }

        var result = [];
        for (var vbzLine in this.cache[dateString]) {
            // console.log(`VBZ Line: ${vbzLine}`);
            for (var routes_code in this.cache[dateString][vbzLine]['route_codes']) {
                // console.log(`Routes: ${routes_code}`);
                var routes = this.cache[dateString][vbzLine]['route_codes'][routes_code].filter(route => {
                    from_time = Math.min(route['from_time_expected'], route['from_time_actual']);
                    to_time = Math.max(route['to_time_expected'], route['to_time_actual']);
                    return ((from >= from_time && from <= to_time) || (to >= from_time && to <= to_time));
                }).map(route => {
                    route['vbzLine'] = vbzLine;
                    return route;
                });

                result.push(...routes);
            }
        }
        return result;
    }
};

app.use(cors());

app.get('/routes', async function (req, res) {
    var from, to;
    if (req.query.now) {
        from = to = req.query.now;
    } else {
        from = req.query.from;
        to = req.query.to;
    }
    res.json(await routes.get(req.query.date, from, to));
});