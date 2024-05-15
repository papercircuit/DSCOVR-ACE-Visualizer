let chart;
// Constants for calculations
const millisPerMinute = 60 * 1000;
const distanceToSun = 93000000; // miles
const radiusSun = 432690; // sun radius in miles
const distanceToL1 = 1000000; // distance to L1 from Earth
const sunGSE = [[91806000, 0, 0]]; // GSE coordinates of the sun
const earthGSE = [[0, 0, 0]]; // GSE coordinates of Earth
const sunEarthLine = [[0, 0, 0], [91806000, 0, 0]]; // line from sun to earth with earth at origin
const l1 = 1600000; // L1 distance in miles
const sezHalfrad = Math.tan(toRadians(0.5)) * l1; // SEZ.5 radius
const sez2rad = Math.tan(toRadians(2)) * l1; // SEZ2 radius
const sez4rad = Math.tan(toRadians(4)) * l1; // SEZ4 radius
let sezHalfDegData = buildCircle(sezHalfrad, 0); // SEZ 0.5 degree radius
let sez2DegData = buildCircle(sez2rad, 0);       // SEZ 2 degrees radius
let sez4DegData = buildCircle(sez4rad, 0);       // SEZ 4 degrees radius
const speedOfLight = 3e8; // m/s 
const frequencyMHz = 2215;
let antennaDiameter = 6; // meters
const wavelength = speedOfLight / (frequencyMHz * 1e6);
let angleRadians = wavelength / antennaDiameter;
let angleDegrees = angleRadians * 57.295779513; // angleDegrees is approximately 1.3 
const minutesPerPoint = 12; // SSCweb data for ACE and DSCOVR is resolution 720 = 12 minutes per point
const pointsPerWeek = 7 * 24 * (60 / minutesPerPoint); // 7 days * 24 hours * 60 minutes / 12 minutes per point
const subsampleFactor = 840; // Default value
let weeksPerOrbit = 26;  // # of samples, e.g., 26 weeks = months = 1 orbit
let startTime, endTime = new Date();
let aceData = [], dscovrData = [];
let beamWidthData = [];

function buildCircle(radius, centerX, centerY, centerZ) {
  let circleData = [];
  for (let i = 0; i <= 360; i += 10) { // Increment by 10 degrees for smoother circles
    let radians = toRadians(i);
    let x = centerX;
    let y = centerY + radius * Math.cos(radians);
    let z = centerZ + radius * Math.sin(radians);
    circleData.push([x, y, z]);
  }
  return circleData;
}

// Helper functions
function toRadians(angle) {
  return angle * (Math.PI / 180);
}

function zeroPad(num) {
  return (num >= 0 && num < 10) ? '0' + num : num;
}

function convertTime(time) {
  let d = '' + time.getUTCFullYear() + zeroPad(time.getUTCMonth() + 1) + zeroPad(time.getUTCDate());
  let t = 'T' + zeroPad(time.getUTCHours()) + zeroPad(time.getUTCMinutes()) + zeroPad(time.getUTCSeconds()) + 'Z';
  return '' + d + t;
}

function defineEndTime() {
  let end = endTime.getTime();
  let offset = weeksPerOrbit * pointsPerWeek * minutesPerPoint * millisPerMinute;
  let start = end - offset;
  startTime = new Date(start);
  updateDateDisplay();
}

// Define the namespace for XML parsing
const namespace = "http://sscweb.gsfc.nasa.gov/schema";

function buildFullUrl() {
  const baseUrl = 'https://sscweb.gsfc.nasa.gov/WS/sscr/2/locations/';
  const observatories = 'ace,dscovr';
  const timeRange = `${convertTime(startTime)},${convertTime(endTime)}`;
  const coordinateSystems = 'gse';
  return `${baseUrl}${observatories}/${timeRange}/${coordinateSystems}/`;
}

function setApiLink(url) {
  const apiLink = document.getElementById('api-link');
  apiLink.textContent = url;
  document.getElementById('api-link').href = url;
}

function updateDateDisplay() {
  const displayStartDate = document.getElementById('displayStartDate');
  const displayEndDate = document.getElementById('displayEndDate');

  displayStartDate.textContent = `Start Date: ${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString()}`;
  displayEndDate.textContent = `End Date: ${endTime.toLocaleDateString()} ${endTime.toLocaleTimeString()}`;
}

//If you are fetching data asynchronously and want to show the loading div during this time, you can modify your fetchDataFromAPI function:
async function fetchDataFromAPI(url) {
  const loadingDiv = document.getElementById('loading');
  loadingDiv.textContent = `Fetching data from SSC Web API`;
  loadingDiv.style.display = 'flex'; // Show the loading div
  setApiLink(url);
  try {
    const response = await fetch(url);
    const data = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data, "application/xml");
    processXMLData(xmlDoc);
  } catch (error) {
    console.error("Error fetching data:", error);
  } finally {
    loadingDiv.style.display = 'none'; // Optionally hide the loading div after fetching
  }
}

function processXMLData(xmlDoc) {
  const namespace = "http://sscweb.gsfc.nasa.gov/schema";
  const dataElements = xmlDoc.getElementsByTagNameNS(namespace, "Data");
  aceData = extractData(dataElements, "ace");
  dscovrData = extractData(dataElements, "dscovr");
  chart.hideLoading();
  updateBeamWidthData();
  updateSEZCircles();
  updateCharts();
}

function extractData(dataElements, id) {
  const element = Array.from(dataElements).find(el => el.querySelector("Id").textContent === id);
  if (!element) {
    console.warn(`${id} Data Element not found`);
    return [];
  }
  const coordinates = element.querySelector("Coordinates");
  const xs = coordinates.getElementsByTagNameNS(namespace, "X");
  const ys = coordinates.getElementsByTagNameNS(namespace, "Y");
  const zs = coordinates.getElementsByTagNameNS(namespace, "Z");
  const times = element.getElementsByTagNameNS(namespace, "Time");

  let data = [];
  let minTime = Number.MAX_SAFE_INTEGER;
  let maxTime = Number.MIN_SAFE_INTEGER;

  // First pass to determine min and max times for opacity scaling
  for (let i = 0; i < times.length; i++) {
    const timeValue = new Date(times[i].textContent).getTime();
    if (timeValue < minTime) minTime = timeValue;
    if (timeValue > maxTime) maxTime = timeValue;
  }

  const minOpacity = 0.2; // Minimum opacity value

  // Second pass to create data points with scaled opacity and color
  for (let i = 0; i < xs.length; i += subsampleFactor) {
    const timeValue = new Date(times[i].textContent).getTime();
    const opacity = minOpacity + (1 - minOpacity) * ((timeValue - minTime) / (maxTime - minTime)); // Scale opacity between minOpacity and 1
    const color = id === "dscovr" ? `rgba(0, 0, 255, ${opacity})` : `rgba(36, 201, 85, ${opacity})`; // Set color based on satellite ID
    data.push({
      x: parseFloat(xs[i].textContent),
      y: parseFloat(ys[i] ? ys[i].textContent : 0),
      z: parseFloat(zs[i] ? zs[i].textContent : 0),
      time: times[i] ? times[i].textContent : null,
      color: color // Set color property
    });
  }
  return data;
}

// Function to update beam width data
function updateBeamWidthData(satellite = 'dscovr') {
  let data = satellite === 'dscovr' ? dscovrData : aceData;
  if (data.length > 0) {
    const lastPosition = data[data.length - 1];
    const distanceToSatellite = Math.sqrt(
      lastPosition.x ** 2 +
      lastPosition.y ** 2 +
      lastPosition.z ** 2
    );
    const beamRadiusMiles = distanceToSatellite * Math.tan(angleRadians);
    beamWidthData = buildCircle(beamRadiusMiles, lastPosition.x, lastPosition.y, lastPosition.z);
  } else {
    console.warn(`${satellite} data is empty. Cannot update beam width data.`);
    beamWidthData = [];
  }
  updateCharts(); // Ensure the charts are updated with the new beam data
}

// Function to update SEZ circles
function updateSEZCircles() {
  const sezHalfrad = Math.tan(toRadians(0.5)) * l1;
  const sez2rad = Math.tan(toRadians(2)) * l1;
  const sez4rad = Math.tan(toRadians(4)) * l1;
  sezHalfDegData = buildCircle(sezHalfrad, 0, 0, 0);
  sez2DegData = buildCircle(sez2rad, 0, 0, 0);
  sez4DegData = buildCircle(sez4rad, 0, 0, 0);
}


function updateCharts() {
  if (chart && chart.series.length > 1) {
    chart.series[0].setData(dscovrData, true);
    chart.series[1].setData(aceData, true);
    chart.series[2].setData(sez2DegData);
    chart.series[3].setData(sez4DegData);
    chart.series[4].setData(beamWidthData);
    chart.series[5].setData(sunGSE);
    chart.series[6].setData(earthGSE);
    chart.series[7].setData(sunEarthLine);
  } else {
    console.error("Chart series not defined or chart not initialized.");
  }
}

// Initialization and execution
defineEndTime();
const fullUrl = buildFullUrl();
console.log('fullUrl', fullUrl);
fetchDataFromAPI(fullUrl);

const container = document.getElementById('container');
let width = container.offsetWidth;
let height = container.offsetHeight;

// Highcharts 3D chart setup
const chartOptions = {
  chart: {
    type: 'scatter3d',
    renderTo: 'container',
    fitToPlot: 'true',
    reflow: 'false',
    // Spacing effects titles and legend only
    spacingTop: 25,
    spacingBottom: 15,
    spacingRight: 10,
    spacingLeft: 10,
    // Margin effects grid and chart! 
    marginTop: 0,
    marginBottom: 30,
    marginRight: 15,
    marginLeft: 15,
    allowMutatingData: false,
    animation: true,
    loading: {
      labelStyle: {
        color: '#000000', // Ensure text color is dark
        fontWeight: 'bold',
        position: 'relative',
        top: '45%'
      },
      style: {
        backgroundColor: '#ffffff', // Light background for contrast
        opacity: 0.75, // Semi-transparent
        textAlign: 'center'
      },
      showDuration: 100,
      hideDuration: 100
    },
    exporting: {
      enabled: true, // Enable exporting
      buttons: {
        contextButton: {
          menuItems: ['downloadPNG', 'downloadJPEG', 'downloadPDF', 'downloadSVG']
        }
      }
    },
    options3d: {
      enabled: true,
      // Setting alpha and beta to zero puts earth on left and satellites on right. alpha rotates on the vertical axis. beta rotates on the horizontal axis.
      alpha: 0, // Rotate vertically
      beta: -90, // Rotate horizontally
      depth: width, // Depth must match width in pixels of container!!!
      viewDistance: 5, // 
      frame: {
        left: { visible: false },
        right: { visible: false },
        front: { visible: false },
        back: { visible: false },
        top: { visible: false },
        bottom: { visible: false }
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
      animation: true,
      animationLimit: 1000,
      animationDuration: 1000,
      turboThreshold: 10000,
      allowPointSelect: true,
      point: {
        events: {
          drag: function (event) {
            event.target.update({ animation: true });
          },
          drop: function (event) {
            event.target.update({ animation: true });
          }
        }
      },
      marker: {
        states: {
          hover: {
            enabled: true,
            lineColor: 'rgb(100,100,100)',
            lineWidth: 1
          },
          select: {
            enabled: true,
            lineColor: 'rgb(100,100,100)',
            lineWidth: 1
          }
        }
      },
      tooltip: {
        shared: false,
        useHTML: true,
        valueDecimals: 0
      }
    }
  },
  yAxis: {
    min: -300000,
    floor: -300000,
    max: 300000,
    title: {
      text: 'GSE Z-axis (miles)'
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
    gridLineWidth: 1,
    title: {
      text: 'GSE X-axis (miles)'
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
      text: 'GSE Y-axis (miles)'
    },
    opposite: false,
    labels: {
      skew3d: true,
      style: {
        color: 'rgba(255,255,255, 0.8)'
      }
    }
  },
  legend: {
    enabled: false,
    width: '100%',
    y: -75, // Vertical position of legend
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
    verticalAlign: 'bottom',
    layout: 'vertical',
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
  responsive: {
    rules: [{
      condition: {
        maxWidth: 500
      },
      chartOptions: {
        legend: {
          layout: 'horizontal',
          align: 'center',
          verticalAlign: 'bottom'
        }
      }
    }]
  },
  accessibility: {
    enabled: true,
    describeSingleSeries: true,
    keyboardNavigation: {
      enabled: true
    },
    point: {
      valueDescriptionFormat: '{index}. {xDescription}, {yDescription}, {zDescription}.'
    }
  },
  series: [
    {
      name: "DSCOVR",
      lineWidth: 0.2,
      lineColor: 'rgba(255, 255, 255, 1)',
      lineZIndex: 1,
      zIndex: 3,
      tooltip: {
        headerFormat: '<span>{series.name}</span>',
        pointFormat: '</span> <br>X GSE :{point.x} <br>Y GSE: {point.y} <br> Z GSE: {point.z} <br> UTC: {point.time}',
        footerFormat: '</p>',
        backgroundColor: {
          linearGradient: [0, 0, 0, 60],
          stops: [
            [0, '#FFFFFF'],
            [1, '#E0E0E0']
          ]
        },
      },
      marker: {
        symbol: 'circle',
        radius: 5,
        lineColor: 'rgba(255, 255, 255, .2)',
        lineWidth: 1
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
        pointFormat: '</span> <br>X GSE: {point.x} <br>Y GSE: {point.y} <br>Z GSE: {point.z} <br> UTC: {point.time}',
        footerFormat: '</p>',
      },
      marker: {
        symbol: 'square',
        radius: 5,
        lineColor: 'rgba(255, 255, 255, .2)',
        lineWidth: 1
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
      color: 'orange',
      marker: {
        enabled: false
      }
    },
    {
      name: 'Antenna Beam',
      lineWidth: 2,
      color: 'purple',
      visible: true,
      marker: {
        fillColor: 'purple',
        symbol: 'circle',
        radius: 1,
      }
    },
    {
      name: "SUN",
      visible: false,
      lineWidth: 1,
      color: 'yellow',
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
        radius: 1,
      }
    }
  ]
};

function addDragFunctionality(chart) {
  let posX;
  let sensitivity = 20; // Sensitivity value for less sensitivity

  const throttledDrag = _.throttle(function (e) {
    e = chart.pointer.normalize(e);
    let deltaX = e.chartX - posX;
    // Round deltaX to the nearest multiple of 5
    deltaX = Math.round(deltaX / 5) * 5;
    const newBeta = chart.options.chart.options3d.beta + deltaX / sensitivity;
    console.log("Delta X:", deltaX, "New Beta:", newBeta); // Debugging output
    chart.update({
      chart: {
        options3d: {
          beta: newBeta
        }
      }
    }, undefined, undefined, false);
    posX = e.chartX;
  }, 100); // Throttle duration to 100 milliseconds

  function dragStart(eStart) {
    eStart = chart.pointer.normalize(eStart);
    posX = eStart.chartX; // Update posX here

    function unbindAll() {
      Highcharts.removeEvent(document, 'mousemove', throttledDrag);
      Highcharts.removeEvent(document, 'touchmove', throttledDrag);
      Highcharts.removeEvent(document, 'mouseup', unbindAll);
      Highcharts.removeEvent(document, 'touchend', unbindAll);
    }

    Highcharts.addEvent(document, 'mousemove', throttledDrag);
    Highcharts.addEvent(document, 'touchmove', throttledDrag);
    Highcharts.addEvent(document, 'mouseup', unbindAll);
    Highcharts.addEvent(document, 'touchend', unbindAll);
  }

  Highcharts.addEvent(chart.container, 'mousedown', dragStart);
  Highcharts.addEvent(chart.container, 'touchstart', dragStart);
}

function createCustomLegend(chart) {
  const legendContainer = document.getElementById('legend');
  legendContainer.innerHTML = ''; // Clear existing legend content
  legendContainer.style.cssText = 'display: flex; flex-direction: row; flex-wrap: nowrap; justify-content: center; align-items: center;';

  chart.series.forEach(series => {
    const legendItem = document.createElement('div');
    legendItem.style.cssText = 'display: flex; align-items: center; margin-right: 10px; font-size: 13px; font-weight: 400;';
    legendItem.classList.add('legend-item');

    const marker = document.createElement('div');
    marker.style.cssText = `display: inline-block; width: 15px; height: 15px; border-radius: 50%; border: 1px solid rgba(255,255,255, 0.6); background-color: ${series.color};`;

    legendItem.appendChild(marker);
    legendItem.appendChild(document.createTextNode(series.name));

    legendItem.classList.toggle('legend-item-hidden', !series.visible);

    legendItem.onclick = () => {
      series.setVisible(!series.visible);
      legendItem.classList.toggle('legend-item-hidden', !series.visible);
    };

    legendContainer.appendChild(legendItem);
  });
}

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
      backgroundColor: {
        color: 'rgb(0, 0, 0)'
      },
      events: {
        load: function () {
          var chart = this;

        }
      },
      redraw: function () {
        createCustomLegend(chart);
      }
    }
  };
  Highcharts.setOptions(Highcharts.theme);

  // Set up the chart
  chart = new Highcharts.Chart(chartOptions);
  addDragFunctionality(chart); // Add drag functionality after chart creation
}

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

// Generate dropdown options
const weeksDropdown = document.getElementById('weeksDropdown');
for (let i = 4; i <= 104; i += 4) {
  const option = document.createElement('option');
  option.value = i;
  option.text = `${i} weeks`;
  if (i === 24) {
    option.selected = true; // Set the default selected option
  }
  weeksDropdown.add(option);
}

// Event listener for the dropdown change event
weeksDropdown.addEventListener('change', function () {
  chart.showLoading('Updating data...');
  weeksPerOrbit = parseInt(this.value);
  defineEndTime();
  const fullUrl = buildFullUrl();
  fetchDataFromAPI(fullUrl).then(() => {
    chart.hideLoading();
  });
});

// Event listener for the antenna dropdown change event
document.getElementById('antennaDropdown').addEventListener('change', function () {
  antennaDiameter = parseFloat(this.value);
  angleRadians = wavelength / antennaDiameter;
  updateBeamWidthData();
  updateCharts();
});

document.getElementById('satelliteDropdown').addEventListener('change', function () {
  updateBeamWidthData(this.value);
});

// Handle window resize
window.addEventListener('resize', function () {
  const container = document.getElementById('container');
  const newWidth = container.offsetWidth;
  if (chart && chart.options && chart.options.chart.options3d) {
    chart.update({
      chart: {
        options3d: {
          depth: newWidth // Adjust depth based on new width
        }
      }
    }, true); // Redraw chart
  }
});

document.addEventListener('keydown', function(event) {
  const key = event.key;
  const rotationStep = 5; // Define the step size for each key press

  if (chart && chart.options && chart.options.chart.options3d) {
      let newBeta = chart.options.chart.options3d.beta;

      if (key === 'ArrowLeft') {
          newBeta -= rotationStep; // Decrease beta to rotate left
      } else if (key === 'ArrowRight') {
          newBeta += rotationStep; // Increase beta to rotate right
      }

      // Update the chart with the new beta value
      chart.update({
          chart: {
              options3d: {
                  beta: newBeta
              }
          }
      }, false); // Redraw chart without animation for smoother rotation
  }
});

// Initialize the chart
create3DChart();

// Fetch initial data with default settings
defineEndTime();
const initialUrl = buildFullUrl();
fetchDataFromAPI(initialUrl);
createCustomLegend(chart);