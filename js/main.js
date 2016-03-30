//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
  //map frame dimensions
  var width = 960,
    height = 460;

  //create new svg container for the map
  var map = d3.select("body")
    .append("svg")
    .attr("class", "map")
    .attr("width", width)
    .attr("height", height);

    //create Albers equal area conic projection
  var projection = d3.geo.albers()
  // .center([44.3, -89.6])
  // .rotate([-2, 0, 0])
  // .parallels([42, 46])
  // .scale(2500)
  // .translate([width / 480, height / 250]);

  //create a path generator
  var path = d3.geo.path()
    .projection(projection);

  //use queue.js to parallelize asynchronous data loading
  d3_queue.queue()
    .defer(d3.csv, "data/Childhood_Lead_Poisoning.csv") //load attributes from csv
    .defer(d3.json, "data/WI_counties_wgs84.topojson") //load choropleth spatial data
    .await(callback);

  function callback(error, csvData, wisconsin){
    //translate wisconsin TopoJSON
    var wisconsinCounties = topojson.feature(wisconsin, wisconsin.objects.WI_counties_wgs84).features;
    console.log(wisconsinCounties)
    //add Wisconsin counties to map
    var counties = map.selectAll(".counties")
        .data(wisconsinCounties)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "counties " + d.properties.CTY_FIPS;
        })
        .attr("d", path);
    };
};
