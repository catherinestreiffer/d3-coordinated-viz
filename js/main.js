//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){

//pseudo-global variables
//list of attributes
var attrArray = ["PERC_POISONED_10_and_up", "perc_poisoned_5_and_up", "built_before_1950_pct", "built_before_1980_pct", "screening_rate"];
var expressed = attrArray[2]; //initial attribute

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
  //map frame dimensions
    var width = window.innerWidth * 0.5,
    height = 460;

  //create new svg container for the map
  var map = d3.select("body")
    .append("svg")
    .attr("class", "map")
    .attr("width", width)
    .attr("height", height);

    //create Albers equal area conic projection
//    var center=[44.2563,-89.6385]
//    var rotate=[104.64, -5.45, 0]
    var projection = d3.geo.albers()
    .center([10.91, 38.15])
    .rotate([104.64, -5.45, 0])
    .parallels([29.5, 45.5])
    .scale(4573.73)
    .translate([width / 2, height / 2]);

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
    //join csv data to GeoJSON enumeration units
    wisconsinCounties = joinData(wisconsinCounties, csvData);
    //create the color scale
var colorScale = makeColorScale(csvData);
    //add enumeration untis to the map
    setEnumerationUnits (wisconsinCounties, map, path, colorScale);
    //add coordinated visualization to the map
    setChart(csvData, colorScale);
  };
}; //end of setMap()

function joinData(wisconsinCounties, csvData) {
  //loop through csv to assign each set of csv attribute values to geojson county
  for (var i=0; i<csvData.length; i++){
    var csvCounty = csvData[i]; //the current county
    // the stupid WI_counties_wgs84 doesn't have the true FIPS (CTY_FIPS + 55000 = FIPS) so subtract 55000 from FIPS to get them to line up
    var csvKey = csvCounty.FIPS - 55000; //the CSV primary key.
    //loop through geojson regions to find correct region
    for (var a=0; a<wisconsinCounties.length; a++){
        var geojsonProps = wisconsinCounties[a].properties; //the current county geojson properties
        var geojsonKey = geojsonProps.CTY_FIPS; //the geojson primary key
        //where primary keys match, transfer csv data to geojson properties object
        if (geojsonKey == csvKey){
          //assign all attributes and values
          attrArray.forEach(function(attr){
          var val = parseFloat(csvCounty[attr]); //get csv attribute value
          geojsonProps[attr] = val; //assign attribute and value to geojson properties
          });
        };
      };
  };
  return wisconsinCounties;
};
function setEnumerationUnits(wisconsinCounties, map, path, colorScale){
  //add Wisconsin counties to map
  var counties = map.selectAll(".counties")
      .data(wisconsinCounties)
      .enter()
      .append("path")
      .attr("class", function(d){
          return "counties " + d.properties.CTY_FIPS;
      })
      .attr("d", path)
      .style("fill", function(d){
            return choropleth(d.properties, colorScale);
      });
};

//function to create coordinated bar chart
function setChart(csvData, colorScale){
    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 460;
        //create a scale to size bars proportionally to frame
    var yScale = d3.scale.linear()
        .range([0, chartHeight])
        .domain([0, 105]);

    //create a second svg element to hold the bar chart
    var chart = d3.select("body")
        .append("svg")
        .attr("width", chartWidth)
        .attr("height", chartHeight)
        .attr("class", "chart");
        //set bars for each province
    var bars = chart.selectAll(".bars")
        .data(csvData)
        .enter()
        .append("rect")
        .sort(function(a, b){
            return a[expressed]-b[expressed]
        })
        .attr("class", function(d){
            return "bars " + d.FIPS;
        })
        .attr("width", chartWidth / csvData.length - 1)
        .attr("x", function(d, i){
            return i * (chartWidth / csvData.length);
        })
        .attr("height", function(d){
            return yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[expressed]));
        })
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });
        //annotate bars with attribute value text
    var numbers = chart.selectAll(".numbers")
        .data(csvData)
        .enter()
        .append("text")
        .sort(function(a, b){
            return a[expressed]-b[expressed]
        })
        .attr("class", function(d){
            return "numbers " + d.FIPS;
        })
        .attr("text-anchor", "middle")
        .attr("x", function(d, i){
            var fraction = chartWidth / csvData.length;
            return i * fraction + (fraction - 1) / 2;
        })
        .attr("y", function(d){
            return chartHeight - yScale(parseFloat(d[expressed])) + 15;
        })
        .text(function(d){
            return d[expressed];
        });
        //below Example 2.8...create a text element for the chart title
    var chartTitle = chart.append("text")
        .attr("x", 20)
        .attr("y", 40)
        .attr("class", "chartTitle")
        .text("Number of Variable " + expressed[3] + " in each county");
};

//function to create color scale generator
function makeColorScale(data){
          var colorClasses = [
              "#D4B9DA",
              "#C994C7",
              "#DF65B0",
              "#DD1C77",
              "#980043"
          ];

          //create color scale generator
          var colorScale = d3.scale.threshold()
              .range(colorClasses);

          //build array of all values of the expressed attribute
          var domainArray = [];
          for (var i=0; i<data.length; i++){
              var val = parseFloat(data[i][expressed]);
              domainArray.push(val);
          };
          //cluster data using ckmeans clustering algorithm to create natural breaks
          var clusters = ss.ckmeans(domainArray, 5);
          //reset domain array to cluster minimums
          domainArray = clusters.map(function(d){
              return d3.min(d);
          });
          //remove first value from domain array to create class breakpoints
          domainArray.shift();

          //assign array of last 4 cluster minimums as domain
          colorScale.domain(domainArray);

          return colorScale;

};
//function to test for data value and return color
function choropleth(props, colorScale){
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (val && val != NaN){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};
})(); //last line of main.js
