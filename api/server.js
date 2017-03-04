// var fs = require('fs');
var app = require('express')();
var server = require('http').Server(app);

// Run the webserver on port 8080
server.listen(8080);

var routes = {
    cache: {},
    get: function(dateString, from, to) {
        if (!(dateString in this.cache)) {
           this.cache[dateString] = require(`../generated/routes_data_${dateString}.json`);
        }

        if (!(dateString in this.cache)) {
            console.error(`Missing data: ${dateString}`);
            return null;
        }

        var result = [];
        for (var zvv_line in this.cache[dateString]) {
            // console.log(`ZVV Line: ${zvv_line}`);
            for (var routes_code in this.cache[dateString][zvv_line]['route_codes']) {
                // console.log(`Routes: ${routes_code}`);
                var routes = this.cache[dateString][zvv_line]['route_codes'][routes_code].filter(route => {
                    from_time = Math.min(route['from_time_expected'], route['from_time_actual']);
                    to_time = Math.max(route['to_time_expected'], route['to_time_actual']);
                    return ((from >= from_time && from <= to_time) || (to >= from_time && to <= to_time));
                });

                result.push(...routes);
            }
        }
        return result;
    }
};

app.get('/routes', function (req, res) {
    var from, to;
    if (req.query.now) {
        from = to = req.query.now;
    } else {
        from = req.query.from;
        to = req.query.to;
    }
    res.json(routes.get(req.query.date, from, to));
});