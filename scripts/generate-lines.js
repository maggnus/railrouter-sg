var got = require('got');
var parseString = require('xml2js').parseString;
var polyline = require('polyline');
var fs = require('fs');

var API = 'http://api.openstreetmap.org/api/0.6/';
var LINES = [ // Refer to http://wiki.openstreetmap.org/wiki/Mass_Rapid_Transit_%28Singapore%29
  // MRT
  {code: 'm-ew', id: 445764},
  {code: 'm-ns', id: 445768},
  {code: 'm-ne', id: 2293545},
  {code: 'm-cc', id: 2076291},
  {code: 'm-dt', id: 2313458},
  // LRT
  {code: 'l-bp', id: 1159434},
  {code: 'l-sw', id: 1146941},
  {code: 'l-se', id: 2312985},
  {code: 'l-pw', id: 2312984},
  {code: 'l-pe', id: 1146942},
  {code: 'l-as', id: 2313372},
];

var get = function(url, callback){
  console.log('Request: ' + url);
  got(url, function(err, body, res){
    if (err) throw err;
    parseString(body, function(e, result){
      if (e) throw e;
      callback(result);
    });
  });
};

var expandTag = function(tags){
  var tag = {};
  tags.forEach(function(t){
    tag[t.$.k] = t.$.v;
  });
  return tag;
};

LINES.forEach(function(line){
  get(API + 'relation/' + line.id + '/full', function(result){
    var osm = result.osm;
    var relation = osm.relation[0];
    var ways = osm.way;
    var nodes = (function(){
      var node = {};
      osm.node.forEach(function(n){
        node[n.$.id] = n;
      });
      return node;
    })();

    var data = {
      meta: expandTag(relation.tag),
      ways: ways.filter(function(way){
        var meta = expandTag(way.tag);
        return meta.railway != 'construction'; // No need under-construction tracks
      }).map(function(way){
        return {
          id: way.$.id,
          visible: way.$.visible,
          meta: expandTag(way.tag),
          coords: way.nd.map(function(nd){
            var ref = nd.$.ref;
            var node = nodes[ref];
            return [parseFloat(node.$.lat, 10), parseFloat(node.$.lon, 10)];
          }),
        };
      }),
      stops: relation.member.filter(function(m){
        var ref = m.$.ref;
        var node = nodes[ref];
        return m.$.type == 'node' && m.$.role == 'stop' && node.tag && expandTag(node.tag).railway != 'construction'; // No need under-construction stops
      }).map(function(stop){
        var ref = stop.$.ref;
        var node = nodes[ref];
        return {
          meta: expandTag(node.tag),
          coord: [parseFloat(node.$.lat, 10), parseFloat(node.$.lon, 10)],
        };
      })
    };

    var filePath = 'data/' + line.code + '.json';
    fs.writeFile(filePath, JSON.stringify(data), function(e){
      if (e) throw e;
      console.log('JSON file generated: ' + filePath);
    });
  });
});