import * as THREE from "./three/three.module.js";
import { Pentacentric } from "./pentacentric.js";

const canvas2d = document.getElementById("canvas2d");
const ctx = canvas2d.getContext("2d");
const canvas3d = document.getElementById("canvas3d");
const renderer = new THREE.WebGLRenderer({
  canvas: canvas3d,
  alpha: true,
  antialias: true,
});
renderer.setPixelRatio(window.devicePixelRatio);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.z = 500;
let hueOffset = 0;
const view = {
  scene,
  camera,
  renderer,
  usePerspectiveCamera: function () {
    this.camera.position.set(0, 0, 500);
  },
};

function resizeCanvas() {
  canvas2d.width = window.innerWidth;
  canvas2d.height = window.innerHeight;
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

window.AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();

let source;
const analyzer = audioContext.createAnalyser();
analyzer.fftSize = 1024;
const data = new Uint8Array(analyzer.frequencyBinCount);

let smoothed = [];
let sineSmoothed = new Float32Array(512).fill(0);
let selectedBuffer = null;
let animationId;
let visualizerMode = "bars";

const pentacentricVisualizer = Pentacentric();
pentacentricVisualizer.init({ analyser: analyzer }, view);
pentacentricVisualizer.make();
pentacentricVisualizer.groupVisible = true;

function getEnergyBands(data, bands = 78) {
  const bandSize = Math.floor(data.length / bands);
  const energies = [];
  for (let i = 0; i < bands; i++) {
    let sum = 0;
    for (let j = 0; j < bandSize; j++) sum += data[i * bandSize + j];
    energies.push(sum / bandSize);
  }
  return energies;
}

function draw() {
  if (visualizerMode === "symBars") {
    canvas2d.style.display = "none";
    canvas3d.style.display = "block";
    pentacentricVisualizer.group.visible = true;

    pentacentricVisualizer.render();
    renderer.render(scene, camera);
  } else {
    canvas2d.style.display = "block";
    canvas3d.style.display = "none";
    if (pentacentricVisualizer.group)
      pentacentricVisualizer.group.visible = false;

    ctx.clearRect(0, 0, canvas2d.width, canvas2d.height);
    analyzer.getByteFrequencyData(data);

    if (visualizerMode === "bars") {
      const bands = getEnergyBands(data, 78);
      if (smoothed.length === 0) smoothed = new Array(bands.length).fill(0);
      const barWidth = canvas2d.width / bands.length;
      for (let i = 0; i < bands.length; i++) {
        smoothed[i] += (bands[i] - smoothed[i]) * 0.2;
        const percent = smoothed[i] / 255;
        const barHeight = canvas2d.height * percent;
        const x = i * barWidth;
        const y = canvas2d.height - barHeight;
        const gradient = ctx.createLinearGradient(0, y, 0, canvas2d.height);
        gradient.addColorStop(0, "#4338ca");
        gradient.addColorStop(1, "#9e98e0ff");
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth * 0.9, barHeight);
      }
    } else if (visualizerMode === "sineWave") {
      analyzer.getByteTimeDomainData(data);
      const sliceWidth = canvas2d.width / data.length;
      const centerY = canvas2d.height / 2;

      for (let l = 0; l < 3; l++) {
        ctx.beginPath();
        const alpha = 1 - l * 0.2;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
          let v = (data[i] - 128) / 128.0;
          sineSmoothed[i] += (v - sineSmoothed[i]) * 1;
          let y = centerY + sineSmoothed[i] * (100 + l * 25);

          const hue = (hueOffset + (i / data.length) * 360) % 360;
          ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${alpha})`;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      }

      hueOffset = (hueOffset + 1) % 360;
    } else if (visualizerMode === "honeycomb") {
      const bands = getEnergyBands(data, 60);
      const hexRadius = 30;
      const hexHeight = Math.sqrt(3) * hexRadius;
      let idx = 0;
      for (let row = 0; row < canvas2d.height / hexHeight + 2; row++) {
        for (let col = 0; col < canvas2d.width / (hexRadius * 1.5) + 2; col++) {
          const x = col * hexRadius * 1.5;
          const y = row * hexHeight + (col % 2 ? hexHeight / 2 : 0);
          const band = bands[idx % bands.length];
          const scale = band / 255;
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = x + hexRadius * Math.cos(angle) * (0.5 + scale);
            const py = y + hexRadius * Math.sin(angle) * (0.5 + scale);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = `hsla(${200 + scale * 160}, 70%, 50%, 0.8)`;
          ctx.fill();
          idx++;
        }
      }
    }
  }

  animationId = requestAnimationFrame(draw);
}

async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

const fileInput = document.getElementById("fileInput");
const uploadLabel = document.getElementById("uploadLabel");

const audioName = document.getElementById("audioName");

fileInput.onchange = async (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedBuffer = await decodeAudioFile(file);
    console.log("Loaded:", file.name);
    uploadLabel.textContent = "File uploaded ✔";
    audioName.textContent = file.name; 
    setTimeout(() => { uploadLabel.textContent = "Upload"; }, 2000);
  }
};

document.getElementById("play").onclick = async () => {
  if (audioContext.state === "suspended") await audioContext.resume();
  if (!selectedBuffer) {
    alert("Please upload an audio file first!");
    return;
  }
  if (source) source.stop();
  source = audioContext.createBufferSource();
  source.buffer = selectedBuffer;
  source.connect(analyzer);
  analyzer.connect(audioContext.destination);
  draw();
  source.start();
};

document.getElementById("stop").onclick = () => {
  if (source) {
    source.stop();
    source.disconnect();
    source = null;
  }
  cancelAnimationFrame(animationId);
  ctx.clearRect(0, 0, canvas2d.width, canvas2d.height);
  renderer.clear();
};

const barsModeButton = document.getElementById("barsMode");
const symBarsModeButton = document.getElementById("symBarsMode");
const waveModeButton = document.getElementById("waveMode");
const honeycombModeButton = document.getElementById("honeycombMode");

function setMode(mode) {
  visualizerMode = mode;
  smoothed = [];
  sineSmoothed = new Float32Array(512).fill(0);

  if (mode === "symBars") {
    canvas2d.style.display = "none";
    canvas3d.style.display = "block";
    pentacentricVisualizer.group.visible = true;
  } else {
    canvas2d.style.display = "block";
    canvas3d.style.display = "none";
    if (pentacentricVisualizer.group)
      pentacentricVisualizer.group.visible = false;
  }

  [
    barsModeButton,
    symBarsModeButton,
    waveModeButton,
    honeycombModeButton,
  ].forEach((btn) => (btn.style.background = "#4f46e5"));
  if (mode === "bars") barsModeButton.style.background = "#16a34a";
  if (mode === "symBars") symBarsModeButton.style.background = "#16a34a";
  if (mode === "sineWave") waveModeButton.style.background = "#16a34a";
  if (mode === "honeycomb") honeycombModeButton.style.background = "#16a34a";
}

barsModeButton.onclick = () => setMode("bars");
symBarsModeButton.onclick = () => setMode("symBars");
waveModeButton.onclick = () => setMode("sineWave");
honeycombModeButton.onclick = () => setMode("honeycomb");

setMode("bars");
