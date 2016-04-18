//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){
//pseudo-global variables
//list of attributes
var attrArray = ["COUNTY","PERC_POISONED_10_and_up", "perc_poisoned_5_and_up", "built_before_1950_pct", "built_before_1980_pct", "screening_rate"];
var expressable = ["PERC_POISONED_10_and_up", "perc_poisoned_5_and_up", "built_before_1950_pct", "built_before_1980_pct", "screening_rate"];
var expressed = expressable[0]; //initial attribute
//attribute names for title and selection in dictionaries (strangely called "maps")
var attributeDescriptions = new Map()
attributeDescriptions.set("PERC_POISONED_10_and_up","Percent of children under 6 with BLL 10 mcg/dL and up");
attributeDescriptions.set("perc_poisoned_5_and_up","Percent of children under 6 with BLL 5 mcg/dL and up");
attributeDescriptions.set("built_before_1950_pct","Percent of housing built before 1950");
attributeDescriptions.set("built_before_1980_pct","Percent of housing built before 1980");
attributeDescriptions.set("screening_rate","Screening rate");
var attributeSelections = new Map()
attributeSelections.set("PERC_POISONED_10_and_up","BLL 10 mcg/dL and up");
attributeSelections.set("perc_poisoned_5_and_up","BLL 5 mcg/dL and up");
attributeSelections.set("built_before_1950_pct","housing built before 1950");
attributeSelections.set("built_before_1980_pct","housing built before 1980");
attributeSelections.set("screening_rate","Screening rate");
// the color classes
var colorClasses = [
    "#bfd3e6",
    "#9ebcda",
    "#8c96c6",
    "#8856a7",
    "#810f7c"
];

//chart frame dimensions
var chartWidth = window.innerWidth * 0.425,
    chartHeight = 473,
    leftPadding = 25,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

//create a scale to size bars proportionally to frame and for axis
var yScale = d3.scale.linear()
    .range([463, 0])
    .domain([0, 110]);

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    //map frame dimensions
    var width = window.innerWidth * 0.5,
    height = 460;
    //create svg container for the map
    var map = d3.select("body")
      .append("svg")
      .attr("class", "map")
      .attr("width", width)
      .attr("height", height);
    //create Albers equal area conic projection
    //I don't know why these projection specifications work, but they do
    var projection = d3.geo.albers()
      .center([-5, 47.5])
      .rotate([90, 0, 0])
      .parallels([30.5, 44.8])
      .scale(4500)
      .translate([0, 0]);

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
      //make the dropdown menu to change the attribute visualized
      createDropdown(csvData);
      //make the legend
      makeLegend(map, 40, height-60, 0, -1);
      //update the legend as a new attribute is selected
      updateLegend(colorScale)
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
          if (isNaN(val)) {
            geojsonProps[attr] = csvCounty[attr]; //assign attribute and value to geojson properties
          }
          else {
            geojsonProps[attr] = val;
          }
          });
        };
      };
  };
  return wisconsinCounties;
};

//function to highlight enumeration units and bars
function highlight(props){
    //change stroke
    var selected = d3.selectAll("[fips='" + props.CTY_FIPS + "']")
        .style({
            "stroke": "orange",
            "stroke-width": "2"
        });
    setLabel(props);
};
//function to reset the element style on mouseout
function dehighlight(props){
    var selected = d3.selectAll("[fips='" + props.CTY_FIPS + "']")
        .style({
            "stroke": function(){
                return getStyle(this, "stroke")
            },
            "stroke-width": function(){
                return getStyle(this, "stroke-width")
            }
        });

    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();

        var styleObject = JSON.parse(styleText);

        return styleObject[styleName];
    };
    d3.select(".infolabel")
    .remove();
};

//function to move info label with mouse
function moveLabel(){
    //get width of label
    var labelWidth = d3.select(".infolabel")
        .node()
        .getBoundingClientRect()
        .width;

    //use coordinates of mousemove event to set label coordinates
    var x1 = d3.event.clientX + 10,
        y1 = d3.event.clientY - 75,
        x2 = d3.event.clientX - labelWidth - 10,
        y2 = d3.event.clientY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
    //vertical label coordinate, testing for overflow
    var y = d3.event.clientY < 75 ? y2 : y1;

    d3.select(".infolabel")
        .style({
            "left": x + "px",
            "top": y + "px"
        });
};

function setEnumerationUnits(wisconsinCounties, map, path, colorScale){
  //add Wisconsin counties to map
  var counties = map.selectAll()
      .data(wisconsinCounties)
      .enter()
      .append("path")
      .attr("class","counties")
      .attr("fips", function(d){
          return d.properties.CTY_FIPS;
      })
      .attr("d", path)
      .style("fill", function(d){
            return choropleth(d.properties, colorScale);
      })
      .style("stroke", "#000")
      .style("stroke-width", "0.5px")
      .on("mouseover", function(d){
           highlight(d.properties)
      })
      .on("mouseout", function(d){
          dehighlight(d.properties)
      })
      .on("mousemove", moveLabel);

    //add style descriptor to each path
  var desc = counties.append("desc")
      .text('{"stroke": "#000", "stroke-width": "0.5px"}');
};

//function to create coordinated bar chart
function setChart(csvData, colorScale){
  //chart frame dimensions
  var chartWidth = window.innerWidth * 0.425,
      chartHeight = 473,
      leftPadding = 25,
      rightPadding = 2,
      topBottomPadding = 5,
      chartInnerWidth = chartWidth - leftPadding - rightPadding,
      chartInnerHeight = chartHeight - topBottomPadding * 2,
      translate = "translate(" + leftPadding + "," + topBottomPadding + ")";
      //create a scale to size bars proportionally to frame
      //create a second svg element to hold the bar chart
      var chart = d3.select("body")
          .append("svg")
          .attr("width", chartWidth)
          .attr("height", chartHeight)
          .attr("class", "chart");

      //create a rectangle for chart background fill except I decided not to fill the background
      var chartBackground = chart.append("rect")
          .attr("class", "chartBackground")
          .attr("width", chartInnerWidth)
          .attr("height", chartInnerHeight)
          .attr("transform", translate);

      //create a scale to size bars proportionally to frame and for axis
      var yScale = d3.scale.linear()
          .range([463, 0])
          .domain([0, 72]); // currently 72 is a magic number. Could make 105* max val of current attribute

      //set bars for each county
      var bars = chart.selectAll(".bar")
          .data(csvData)
          .enter()
          .append("rect")
          .sort(function(a, b){ //sorts highest to lowest
              return b[expressed]-a[expressed]
          })
          .attr("class", function(d){
              return "bar " + d.CTY_FIPS;
          })
          .attr("width", chartInnerWidth / csvData.length - 1)
         .on("mouseover", highlight)
         .on("mouseout", dehighlight)
         .on("mousemove", moveLabel)
          .attr("x", function(d, i){
              return i * (chartInnerWidth / csvData.length) + leftPadding;
          });
      //add style descriptor to each rect
      var desc = bars.append("desc")
        .text('{"stroke": "none", "stroke-width": "0px"}');

      //create a text element for the chart title
      var chartTitle = chart.append("text")
          .attr("x", 40)
          .attr("y", 40)
          .attr("class", "chartTitle")

      //create vertical axis generator
      var yAxis = d3.svg.axis()
          .scale(yScale)
          .orient("left");

      //place axis
      var axis = chart.append("g")
          .attr("class", "axis")
          .attr("transform", translate)
          .call(yAxis);

      //create frame for chart border
      var chartFrame = chart.append("rect")
          .attr("class", "chartFrame")
          .attr("width", chartInnerWidth)
          .attr("height", chartInnerHeight)
          .attr("transform", translate);

      //set bar positions, heights, and colors
      updateChart(bars, csvData.length, colorScale);
  };
  //function to create dynamic label
  function setLabel(props){
      //label content
      var labelAttribute = "<h1>" + props[expressed] + "%" +
          "</h1><b>" + attributeSelections.get(expressed) + "</b>";

      //create info label div
      var infolabel = d3.select("body")
          .append("div")
          .attr({
              "class": "infolabel",
              "id": props.CTY_FIPS + "_label"
          })
          .html(labelAttribute);

      var countyName = infolabel.append("div")
          .attr("class", "labelname")
          .html(props.COUNTY);
  };
  //function to position, size, and color bars in chart
function updateChart(bars, n, colorScale){
    //position bars
    bars.attr("x", function(d, i){
            return i * (chartInnerWidth / n) + leftPadding;
        })
        //size/resize bars
        .attr("height", function(d, i){
            return 463 - yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d, i){
            return yScale(parseFloat(d[expressed])) + topBottomPadding;
        })
        //color/recolor bars
        .style("fill", function(d){
            return choropleth(d, colorScale);
        });
        //at the bottom of updateChart()...add text to chart title
    var chartTitle = d3.select(".chartTitle")
        .text(attributeDescriptions.get(expressed) + " in each county");
};
//function to create color scale generator
function makeColorScale(data){
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
    //if attribute value exists, assign a color; otherwise assign light gray
    if (val && val != NaN){
        return colorScale(val);
    } else {
        return "#edf8fb";
    };
};

//function to create a dropdown menu for attribute selection
function createDropdown(csvData){
    //add select element
    var dropdown = d3.select("body")
        .append("select")
        .attr("class", "dropdown")
        .on("change", function(){
            changeAttribute(this.value, csvData)
        });
    //add initial option
    var titleOption = dropdown.append("option")
        .attr("class", "titleOption")
        .attr("disabled", "true")
        .text("Select Attribute");

    //add attribute name options
    var attrOptions = dropdown.selectAll("attrOptions")
        .data(expressable)
        .enter()
        .append("option")
        .attr("value", function(d){ return d })
        .text(function(d){ return attributeSelections.get(d) });
};
//dropdown change listener handler
function changeAttribute(attribute, csvData){
    //change the expressed attribute
    expressed = attribute;

    //recreate the color scale
    var colorScale = makeColorScale(csvData);

    //recolor enumeration units
    var counties = d3.selectAll(".counties")
        .transition()
        .duration(1000)
        .style("fill", function(d){
            return choropleth(d.properties, colorScale)
        });
        //re-sort, resize, and recolor bars
    var bars = d3.selectAll(".bar")
        //re-sort bars
        .sort(function(a, b){
            return b[expressed] - a[expressed];
        })
        .attr("x", function(d, i){
            return i * (chartInnerWidth / csvData.length) + leftPadding;
        })
        .transition() //add animation
        .delay(function(d, i){
            return i * 20
        })
        .duration(500);
    updateChart(bars, csvData.length, colorScale);
    updateLegend(colorScale)
};

//Adding legend for our choropleth
//adapted from static legend in http://bl.ocks.org/KoGor/5685876
function makeLegend(map,startX,startY,xDir,yDir){

var ls_w = 20, ls_h = 20;

var legend = map.selectAll("g.legend")
.data(colorClasses)
.enter().append("g")
.attr("class","legend")

legend.append("rect")
.attr("x", function(d, i){ return startX + xDir*(i*ls_w);})
.attr("y", function(d, i){ return startY + yDir*(i*ls_h);})
.attr("width", ls_w)
.attr("height", ls_h)
.style("fill", function(d, i) { return d })
.style("opacity", 0.8)
.attr("class", "legendSquare")

legend.append("text")
.attr("x", function(d, i){ return startX + xDir*(i*ls_w) + 30;})
.attr("y", function(d, i){ return startY + yDir*(i*ls_h) + ls_h - 4;})
.attr("class", "legendSquareText")
};

// Setting color domains(intervals of values) for our map
function updateLegend(colorScale) {
  thresholds=colorScale.domain()
  legendTexts = []
  legendTexts.push("<"+thresholds[0]+"%")
  thresholds.forEach(function(d) {
    legendTexts.push(d+"%+")
  }
  )
  d3.selectAll(".legendSquareText")
  .text(function(d, i){ return legendTexts[i]})
};


})(); //last line of main.js
