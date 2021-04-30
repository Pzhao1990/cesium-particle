import { Particle3D, Vortex } from '../index';
import * as ceiusm_map from './map';
import {VortexPanel, ControlPanel} from './gui';
import { colorTable } from './options';

// initialization
ceiusm_map.initMap('cesiumContainer');
var vortexPanel = new VortexPanel("vortexPanelContainer");

var controlPanel = new ControlPanel("panelContainer", userInput => {
  particleObj && particleObj.optionsChange(userInput);
});

var viewer = ceiusm_map.getViewer();

var userInput = controlPanel.getUserInput();

const fileInput = document.getElementById('fileInput');
const loadBtn = document.getElementById('load');
const generateDataBtn = document.getElementById('generateData');
const statechangeBtn = document.getElementById('statechange');
const removeBtn = document.getElementById('remove');
var particleObj = null, working = false;

// 加载nc文件按钮
loadBtn.onclick = function () {
  if (fileInput.files[0] && viewer && !particleObj) {
    let file = fileInput.files[0];
    particleObj = new Particle3D(viewer, {
      input: file,
      colorTable: colorTable
    });
    particleObj.start();
    statechangeBtn.disabled = false;
    removeBtn.disabled = false;
    loadBtn.disabled = true;
    generateDataBtn.disabled = true;
    statechangeBtn.innerText = '隐藏';
    working = true;
  }
};

// 生成涡旋数据按钮
generateDataBtn.onclick = function () {
  let parameter = vortexPanel.getUserInput();
  if (parameter && viewer && !particleObj) {
    let jsonData = new Vortex(...parameter).getData();
    particleObj = new Particle3D(viewer, {
      input: jsonData,
      type: 'json',
      colorTable: colorTable
    });
    particleObj.start();
    statechangeBtn.disabled = false;
    removeBtn.disabled = false;
    loadBtn.disabled = true;
    generateDataBtn.disabled = true;
    statechangeBtn.innerText = '隐藏';
    working = true;
  }
};

statechangeBtn.onclick = function () {
  if (particleObj) {
    !working ? particleObj.start() : particleObj.stop();
    !working ? statechangeBtn.innerText = '隐藏' : statechangeBtn.innerText = '显示';
    working = !working;
  }
}

removeBtn.onclick = function () {
  if (particleObj) {
    particleObj.remove();
    working = false;
    statechangeBtn.innerText = '显示'
    particleObj = null;
    statechangeBtn.disabled = true;
    removeBtn.disabled = true;
    loadBtn.disabled = false;
    generateDataBtn.disabled = false;
  }
}