const millisPerMinute = 60 * 1000;
const distanceToSun = 93000000; // miles
const radiusSun = 432690; // sun radius in miles
const distanceToL1 = 1000000; // distance to l1 from earth
const sunGSE = [[91806000, 0, 0]]; // GSE coordinates of the sun
const earthGSE = [[0, 0, 0]]; // GSE coordinates of Earth
const sunEarthLine = [[0, 0, 0], [91806000, 0, 0]] // line from sun to earth with earth at origin
const l1 = 1600000; // L1 distance in miles
const sezHalfrad = Math.tan(toRadians(0.5)) * l1; // SEZ.5 radius
const sez2rad = Math.tan(toRadians(2)) * l1; // SEZ2 radius
const sez4rad = Math.tan(toRadians(4)) * l1; // SEZ4 radius

const minutesPerPoint = 12;// SSCweb data for ACE and DSCOVR is resolution 720 = 12 minutes per point
const pointsPerDay = 7 * 24; // 7 days * 24 hours
const pointsPerWeek = 7 * 24 * (60 / minutesPerPoint); // 7 days * 24 hours * 60 minutes / 12 minutes per point
const endTime = new Date()
let weeksPerOrbit = 26;  // # of samples, e.g., 26 weeks = months = 1 orbit

let startTime;
let aceData = [];
let dscovrData = [];
let dscovrBackgroundColor = [];
let aceBackgroundColor = [];
let alpha = Math.atan(radiusSun / distanceToSun);
let radiusSunAtL1 = distanceToL1 * Math.tan(alpha) * 1.6;
let windowWidth = function () {
  return $(window).width();
}
let windowHeight = function () {
  return $(window).height();
}


// Build a circle for the SEZ2 and SEZ4 boundaries
function buildCircle(radius, x) {
  let circleData = [];
  // this is the angle in radians
  for (let i = 0; i <= 360; i = i + 10) {  // <== Set circle resolution here
    // this is the x,y of the circle
    circleData.push([x, radius * Math.cos(toRadians(i)), radius * Math.sin(toRadians(i))]);
  }
  return circleData;
}

const sezHalfDeg = buildCircle(sezHalfrad, l1); // SEZ.5 boundary
const sez2Deg = buildCircle(sez2rad, l1); // SEZ2 boundary
const sez4Deg = buildCircle(sez4rad, l1); // Build a circle for the SEZ4 boundary

// convert degrees to radians
function toRadians(angle) {
  return angle * (Math.PI / 180);
}

// set how far back in time to go
function defineEndTime() {
  let end = endTime.getTime();
  // offset is made by the number of weeks per orbit * the number of milliseconds per week. To adjust the time range, change the number of weeks per orbit. 
  let offset = weeksPerOrbit * pointsPerWeek * minutesPerPoint * millisPerMinute;
  //convert hours to milliseconds. hours back in time.
  let start = end - offset;
  startTime = new Date(start);
}



// concatinate string to access SSC api
function convertTime(time) {
  let d = '' + time.getUTCFullYear() + zeroPad(time.getUTCMonth() + 1) + zeroPad(time.getUTCDate());
  let t = 'T' + zeroPad(time.getUTCHours()) + zeroPad(time.getUTCMinutes()) + zeroPad(time.getUTCSeconds()) + 'Z';
  return '' + d + t;
}

// pad single digit numbers with a leading zero
function zeroPad(num) {
  // if num is less than 10, add a leading zero
  return (num >= 0 && num < 10) ? '0' + num : num;
}

// compute the time range of data to request from NASA.
defineEndTime();
let start = convertTime(startTime);
let end = convertTime(endTime);

// build the url to access the SSC api
let sscUrl = 'https://sscweb.gsfc.nasa.gov/WS/sscr/2/locations/ace,dscovr/' + start + ',' + end + '/';
console.log(sscUrl);

/**
 * 
 * @param {Array} positionData Spacecraft position data
 * 
 */

// fetch the data from the SSC api 
// https://sscweb.gsfc.nasa.gov/

function fetchData(positionData) {
  // get the ACE data
  // "size" in ACEsize and DSCOVRsize refers to the number of points in the data set
  // https://sscweb.gsfc.nasa.gov/WebServices/REST/#Get_Observatories
  let ace = {};
  let ACEsize = positionData.Result.Data[1][0].Time[1].length;
  ace.time_tag = positionData.Result.Data[1][0].Time[1];
  ace.x_gse = positionData.Result.Data[1][0].Coordinates[1][0].X[1];
  ace.y_gse = positionData.Result.Data[1][0].Coordinates[1][0].Y[1];
  ace.z_gse = positionData.Result.Data[1][0].Coordinates[1][0].Z[1];


  // Swap Y GSE for Z to convert from GSE to local and push the data into the aceData array
  for (let i = 0; i < ACEsize; i++) {
    if (ace.time_tag[i] != undefined) {
      aceData.push({
        custom: ace.time_tag[i][1].substring(0, 22),
        x_gse: ace.x_gse[i],
        y_gse: ace.z_gse[i],
        z_gse: ace.y_gse[i]
      });
    }
  }

  // get the DSCOVR data
  let dscovr = {};
  let DSCOVRsize = positionData.Result.Data[1][0].Time[1].length;
  dscovr.time_tag = positionData.Result.Data[1][1].Time[1];
  dscovr.x_gse = positionData.Result.Data[1][1].Coordinates[1][0].X[1];
  dscovr.y_gse = positionData.Result.Data[1][1].Coordinates[1][0].Y[1];
  dscovr.z_gse = positionData.Result.Data[1][1].Coordinates[1][0].Z[1];

  // Swap Y GSE for Z to convert from GSE to local and push the data into the dscovrData array
  for (let i = 0; i < DSCOVRsize; i++) {
    if (dscovr.time_tag[i] != undefined) {
      dscovrData.push({
        custom: dscovr.time_tag[i][1].substring(0, 22),
        x_gse: dscovr.x_gse[i],
        y_gse: dscovr.z_gse[i],
        z_gse: dscovr.y_gse[i]
      });
    }
  }

  // clean up the data and reverse the time order      
  let tempAce = skipDuplicates(aceData);
  let tempDscovr = skipDuplicates(dscovrData);

  // subsample the data to improve rendering performance 
  aceData = subsample(tempAce);
  dscovrData = subsample(tempDscovr);

  // Prepare the data for the chart
  function prepareDscovrData(data) {
    let result = [];
    for (let i = 1; i < data.length; i++) {

      result.push({
        name: 'DSCOVR',
        x: data[i].x_gse,
        y: data[i].y_gse,
        z: data[i].z_gse,
        custom: data[i].custom,
        color: 'rgba(0, 0, 255,' + i / data.length + ')'
      });
    }
    return result;
  }

  function prepareAceData(data) {
    let result = [];
    for (let i = 0; i < data.length; i++) {
      result.push({
        name: 'ACE',
        x: data[i].x_gse,
        y: data[i].y_gse,
        z: data[i].z_gse,
        custom: data[i].custom,
        color: 'rgba(0, 255, 0,' + i / data.length + ')'
      });
    }
    return result;
  }

  // Calculate Solar Earth Vehicle angle for each data point
  let dscovrSEV = [];
  let aceSEV = [];

  const calculateSEV = (data) => {
    let sunGSE_X = sunGSE[0][0];
    let sunGSE_Y = sunGSE[0][1];
    let sunGSE_Z = sunGSE[0][2];

    let sev = Math.acos((data.x_gse * sunGSE_X + data.y_gse * sunGSE_Y + data.z_gse * sunGSE_Z) /
      (Math.sqrt(data.x_gse * data.x_gse + data.y_gse * data.y_gse + data.z_gse * data.z_gse) *
        Math.sqrt(sunGSE_X * sunGSE_X + sunGSE_Y * sunGSE_Y + sunGSE_Z * sunGSE_Z))) * 180 / Math.PI;

    // console.log("SEV angle: " + sev + " degrees")
    return sev;
  }



  for (let i = 0; i < dscovrData.length; i++) {
    dscovrSEV.push(calculateSEV(dscovrData[i]));
  }
  for (let i = 0; i < aceData.length; i++) {
    aceSEV.push(calculateSEV(aceData[i]));
  }
  console.log(dscovrSEV);
  console.log(aceSEV);


  aceData3d = prepareAceData(aceData);
  dscovrData3d = prepareDscovrData(dscovrData);


}

function skipDuplicates(input) {
  let results = [];
  let i;
  let last;
  for (i = input.length - 1; i >= 0; i--) {
    if (input[i] !== last) {
      results.push(input[i]);
    }
    last = input[i];
  }
  return results;
}

function subsample(inputData) {
  let i;
  let outputData = [];
  for (i = 0; i < pointsPerWeek * weeksPerOrbit; i += pointsPerWeek) {
    outputData.push(inputData[i]);
  }
  return outputData;
}

console.time('fetchData')

// Get the data from the SSC api using Axios
axios.get(sscUrl)
  .then(function (response) {
    fetchData(response.data);

    // store the data in local storage
    localStorage.setItem('aceData', JSON.stringify(aceData));
    localStorage.setItem('dscovrData', JSON.stringify(dscovrData));
    localStorage.setItem('dscovrBackgroundColor', JSON.stringify(dscovrBackgroundColor));
    localStorage.setItem('aceBackgroundColor', JSON.stringify(aceBackgroundColor));
    // console.log(localStorage.getItem('aceData'));
    // console.log(localStorage.getItem('dscovrData'));

    // FEED DATA TO HIGHCHARTS
    chart.series[0].setData(dscovrData3d);
    chart.series[1].setData(aceData3d);
    chart.series[2].setData(sez2Deg);
    chart.series[3].setData(sez4Deg);
    chart.series[4].setData(sunGSE);
    chart.series[5].setData(earthGSE);
    chart.series[6].setData(sunEarthLine)
  })
  .catch(function (error) {
    console.log(error);
  })

  // HIGHCHARTS CONFIGURATION BEGINS HERE
  (function (H) {
    try {
      function create3DChart() {
        // Theme loads before data 
        Highcharts.theme = {
          title: {
            style: {
              color: 'rgb(250, 250, 250)',
              font: 'bold 25px "Arial", sans-serif'
            }
          },
          subtitle: {
            style: {
              color: '#666666',
              font: 'bold 12px "Arial", sans-serif'
            }
          },
          legend: {
            symbolPadding: 10,
            itemStyle: {
              font: '10pt Trebuchet MS, Verdana, sans-serif'
            },
            itemHoverStyle: {
              color: 'gray'
            }
          },
          chart: {
            // set background color to black
            backgroundColor: {
              color: 'rgb(0, 0, 0)'
            }
          }

        };
        Highcharts.setOptions(Highcharts.theme);

        // Set up the chart
        chart = new Highcharts.Chart({
          chart: {
            type: 'scatter3d',
            renderTo: 'container', // Target element id
            fitToPlot: 'true',
            reflow: 'false',
            // Spacing effects titles and legend only
            spacingTop: 25,
            spacingBottom: 15,
            spacingRight: 10,
            spacingLeft: 10,
            // Margin effects grid and chart!
            marginTop: 0,
            marginBottom: 0,
            marginRight: 0,
            marginLeft: 0,
            // KEEP SQUARE!
            // Get screen width from window object using jQuery. update on resize
            // width: windowWidth(),
            // height: windowWidth(),
            // set responsive rules to keep chart and 3d frame square
            allowMutatingData: false,
            animation: true,
            // Set loading screen
            exporting: {
              enabled: false
            },
            events: {
              load() {
                const chart = this;
                chart.showLoading('Fetching data from NASA...');
                setTimeout(function () {
                  chart.hideLoading();
                  chart.series[0].setData()
                }, 1700);

              }
            },
            options3d: {
              enabled: true,
              // Setting alpha and beta to zero puts earth on left and satellites on right. alpha rotates on the vertical axis. beta rotates on the horizontal axis.
              alpha: 0,
              beta: -90,
              // MUST MATCH WIDTH AND HEIGHT OF CHART
              depth: 500,
              viewDistance: 3,
              frame: {
                left: { // Camera front
                  visible: false,
                },
                right: { // Camera back
                  visible: false,
                },
                front: { // Camera right
                  visible: false,
                },
                back: { // Camera left
                  visible: false,
                },
                top: {
                  visible: false,
                },
                bottom: { // Camera bottom
                  visible: false,
                }
              }
            }
          },
          title: {
            text: null
          },
          subtitle: {
            text: null,
            align: 'center'

          },
          plotOptions: {
            scatter3d: {
              // animation on load only
              animation: true,
              animationLimit: 1000,
              animationDuration: 1000,
              turboThreshold: 100000,
              allowPointSelect: true,
              point: {
                events: {
                  drag: function (event) {
                    event.target.update({
                      animation: false
                    });
                  },
                  drop: function (event) {
                    event.target.update({
                      animation: true
                    });
                  }
                }
              },
              marker: {
                states: {
                  hover: {
                    enabled: true,
                    lineColor: 'rgb(100,100,100)',
                    lineWidth: 1,
                  },
                  select: {
                    enabled: true,
                    lineColor: 'rgb(100,100,100)',
                    lineWidth: 1,
                  }
                }
              },
              // Set the style and default values for tooltips on hover
              tooltip: {
                shared: false,
                useHTML: true,
                valueDecimals: 0, // Set decimals following each value in tooltip
              },
            }
          },
          // GSE 0 is at Earth.
          // X = Sun-Earth line
          // Y = Sun Earth ecliptic
          // Z = Up Down

          // X = Y GSE
          // Y = Z GSE
          // Z = X GSE
          yAxis: {
            min: -300000,
            floor: -300000,
            max: 300000,
            title: {
              text: 'GSE Z-axis'
            },

            opposite: true,
            labels: {
              skew3d: true,
              style: {
                color: 'rgba(255,255,255, 0.8)'
              }
            }
          },
          xAxis: {
            zoomEnabled: true,
            floor: 0,
            // min: 0,
            // max: 160000000,
            gridLineWidth: 1,
            title: {
              text: 'GSE X-axis'
            },
            opposite: false,
            labels: {
              skew3d: true,
              style: {
                color: 'rgba(255,255,255, 0.8)'
              }
            }
          },
          zAxis: {
            min: -300000,
            floor: -300000,
            max: 300000,
            title: {
              text: 'GSE Y-axis'
            },
            opposite: false,
            labels: {
              skew3d: true,
              style: {
                color: 'rgba(255,255,255, 0.8)'
              }
            }
          },
          // Set the legend
          legend: {
            enabled: true,
            width: '100%',
            title: {
              text: 'Click to hide/show',
              style: {
                color: 'rgba(255,255,255, 0.8)',
                fontSize: '10px',
                fontWeight: 'light',
                letterSpacing: '1px'
              }
            },
            align: 'center',
            verticalAlign: 'top',
            layout: 'horizontal',
            labelFormatter: function () {
              return this.name;
            },
            itemStyle: {
              color: 'rgba(255,255,255, 0.8)'
            },
            itemHoverStyle: {
              color: 'rgba(255,255,255, 1)'
            },
            itemHiddenStyle: {
              color: 'rgba(255,255,255, 0.3)'
            }
          },
          // SERIES CONFIGURATION BEGINS HERE
          series: [
            {

              name: "DSCOVR",
              lineWidth: 0.2,
              lineColor: 'rgba(255, 255, 255, 1)',
              lineZIndex: 1,
              zIndex: 3,
              tooltip: {
                headerFormat: '<span>{series.name}</span>',
                pointFormat: '</span> <br>X GSE :{point.x} <br>Y GSE: {point.y} <br> Z GSE: {point.z} <br> UTC: {point.custom}',
                footerFormat: '</p>'
              },
              marker: {
                symbol: 'circle',
                radius: 5,
              },
              color: 'rgb(0, 0, 255)'
            },
            {
              name: "ACE",
              lineWidth: 0.2,
              lineColor: 'rgba(255, 255, 255, 1)',
              lineZIndex: 1,
              zIndex: 3,
              tooltip: {
                headerFormat: '<span>{series.name}</span>',
                pointFormat: '</span> <br>X GSE: {point.x} <br>Y GSE: {point.y} <br>Z GSE: {point.z} <br> UTC: {point.custom}',
                footerFormat: '</p>',
              },
              marker: {
                symbol: 'circle',
                radius: 5,
              },
              color: 'rgb(36, 201, 85)'
            },
            {
              name: "SEZ 2.0 deg",
              lineWidth: 1,
              visible: true,
              zIndex: 2,
              color: 'rgba(255, 0, 0, 1)',
              marker: {
                enabled: false
              }
            },
            {
              name: "SEZ 4.0 deg",
              lineWidth: 1,
              visible: true,
              zIndex: 2,
              color: 'rgba(255, 255, 51, 1)',
              marker: {
                enabled: false
              }

            },
            {
              name: "SUN",
              visible: false,
              lineWidth: 1,
              zIndex: 1,
              marker: {
                fillColor: 'yellow',
                symbol: 'url(imgs/sun.png)',
                height: 34,
                width: 34,
              }

            },
            {
              name: "EARTH",
              lineWidth: 1,
              zIndex: 2,
              visible: false,
              marker: {
                fillColor: 'blue',
                // symbol: 'circle',
                symbol: 'url(imgs/earth.png)',
                height: 15,
                width: 15,
                radius: 1,
              }
            },
            {
              name: "Sun-Earth line",
              lineWidth: 1,
              visible: false,
              marker: {
                fillColor: 'orange',
                symbol: 'circle',
                // symbol: 'url(imgs/sun.jpeg)', NEED TO CENTER
                radius: 1,
              }
            }
            // SERIES CONFIGURATION ENDS HERE
          ]
        });

        // BUTTONS ---------------------------------------------

        // Reset Camera button
        document.getElementById('resetBtn').addEventListener('click', function () {
          chart.update({
            chart: {
              options3d: {
                alpha: 0,
                beta: -90
              }
            }
          });
        });

        // Zoom In button
        document.getElementById('zoomInBtn').addEventListener('click', function () {
          // Scale down all data points
          chart.series.forEach(function (series) {
            series.data.forEach(function (point) {
              point.update({
                x: point.x * 1.5,
                y: point.y * 1.5,
                z: point.z * 1.5
              }, false); // false to disable redraw
            });
          });
          chart.redraw(); // manually redraw after all points have been updated
        });

        // Zoom Out button
        document.getElementById('zoomOutBtn').addEventListener('click', function () {
          // Scale up all data points
          chart.series.forEach(function (series) {
            series.data.forEach(function (point) {
              point.update({
                x: point.x / 1.5,
                y: point.y / 1.5,
                z: point.z / 1.5
              }, false); // false to disable redraw
            });
          });
          chart.redraw(); // manually redraw after all points have been updated
        });




      }


      // Resize chart based on responsive wrapper
      var wrapper = $('.wrapper'),
        container = $('#container'),
        wrapperHeight,
        wrapperWidth;

      var updateValues = function () {
        // add 150 to wrapper height to account for the height of the legend. 
        Math.min(850, wrapperHeight = wrapper.height() - 150);
        Math.min(700, wrapperWidth = wrapper.width());
      };
      // Check if wrapper is taller than it is wide, and set chart height and width accordingly
      var adjustContainer = function () {
        if (wrapperHeight <= wrapperWidth) {
          container.width(wrapperHeight);
          container.height('100%')
        } else {
          container.height(wrapperWidth);
          container.width('100%')
        }
      };

      //  Set chart depth on window load
      $(window).on('load', function () {
        // update slider-value with current value
        $("#slider-value").text($("#slider").val());
        updateValues();
        adjustContainer();
        // update options3d depth
        chart.update({
          chart: {
            options3d: {
              depth: wrapperWidth
            }
          }
        });
      })

      // Resize chart on window resize
      $(window).on('resize', function () {

        updateValues();
        adjustContainer();
        // update options3d depth
        chart.update({
          chart: {
            options3d: {
              depth: wrapperWidth
            }
          }
        });

      })
      updateValues()
      adjustContainer();

      // Listen for slider changes
      $("#slider").on("change", function () {
        // update slider-value element with current value
        $("#slider-value").text(this.value);
        weeksPerOrbit = parseInt(this.value);
        defineEndTime();
        start = convertTime(startTime);
        end = convertTime(endTime);
        sscUrl = 'https://sscweb.gsfc.nasa.gov/WS/sscr/2/locations/ace,dscovr/' + start + ',' + end + '/';
        console.log(sscUrl);
        axios.get(sscUrl)
          .then(function (response) {
            fetchData(response.data);

            // store the data in local storage
            localStorage.setItem('aceData', JSON.stringify(aceData));
            localStorage.setItem('dscovrData', JSON.stringify(dscovrData));
            localStorage.setItem('dscovrBackgroundColor', JSON.stringify(dscovrBackgroundColor));
            localStorage.setItem('aceBackgroundColor', JSON.stringify(aceBackgroundColor));
            // console.log(localStorage.getItem('aceData'));
            // console.log(localStorage.getItem('dscovrData'));

            // FEED DATA TO HIGHCHARTS
            chart.series[0].setData(dscovrData3d);
            chart.series[1].setData(aceData3d);
          })
      });

      // Make the chart draggable
      function dragStart(eStart) {
        eStart = chart.pointer.normalize(eStart);

        let posX = eStart.chartX,
          posY = eStart.chartY,
          alpha = chart.options.chart.options3d.alpha,
          beta = chart.options.chart.options3d.beta

        sensitivity = 10,  // lower is more sensitive
          handlers = [];

        let updatePending = false;
        let latestEvent = null;

        function drag(e) {
          // Store the latest event and request an animation frame if one is not already pending
          latestEvent = e;
          if (!updatePending) {
            updatePending = true;
            requestAnimationFrame(() => {
              updatePending = false;
              // Get e.chartX and e.chartY
              e = chart.pointer.normalize(latestEvent);

              chart.update({
                chart: {
                  options3d: {
                    alpha: 0,
                    beta: beta + (posX - e.chartX) / sensitivity,
                    viewDistance: 3

                  }
                }
              }, undefined, undefined, false);
            });
          }
        }

        console.log("alpha", alpha);

        function unbindAll() {
          handlers.forEach(function (unbind) {
            if (unbind) {
              unbind();
            }
          });
          handlers.length = 0;
        }

        handlers.push(H.addEvent(document, 'mousemove', drag));
        handlers.push(H.addEvent(document, 'touchmove', drag));

        handlers.push(H.addEvent(document, 'mouseup', unbindAll));
        handlers.push(H.addEvent(document, 'touchend', unbindAll));
      }

      create3DChart();
      if ('ontouchstart' in window) {
        H.addEvent(chart.container, 'touchstart', dragStart);
      } else {
        H.addEvent(chart.container, 'mousedown', dragStart);
      }

    } catch (e) {
      console.log(e);
    }

  }(Highcharts));

// Created by Kenny Johnson and Jeff Johnson
// Email for questions/comment/job offers kenny.johnson.nyc@gmail.com