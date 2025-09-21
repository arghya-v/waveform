const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
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
let selectedBuffer = null;
let animationId;

let visualizerMode = "bars";
let sineSmoothed = new Float32Array(512).fill(0); 

function getEnergyBands(data, bands = 78) {
  const bandSize = Math.floor(data.length / bands);
  const energies = [];
  for (let i = 0; i < bands; i++) {
    let sum = 0;
    for (let j = 0; j < bandSize; j++) {
      sum += data[i * bandSize + j];
    }
    energies.push(sum / bandSize);
  }
  return energies;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  analyzer.getByteFrequencyData(data);

  if (visualizerMode === "bars") {
    const bands = getEnergyBands(data, 78);
    if (smoothed.length === 0) smoothed = new Array(bands.length).fill(0);

    const barWidth = canvas.width / bands.length;
    for (let i = 0; i < bands.length; i++) {
      smoothed[i] += (bands[i] - smoothed[i]) * 0.2;
      const percent = smoothed[i] / 255;
      const barHeight = canvas.height * percent;
      const x = i * barWidth;
      const y = canvas.height - barHeight;

      const gradient = ctx.createLinearGradient(0, y, 0, canvas.height);
      gradient.addColorStop(0, "#4338ca");
      gradient.addColorStop(1, "#9e98e0ff");

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth * 0.9, barHeight);
    }

  } else if (visualizerMode === "symBars") {
    const bands = getEnergyBands(data, 60);
    if (smoothed.length === 0) smoothed = new Array(bands.length).fill(0);

    const barWidth = canvas.width / bands.length;
    for (let i = 0; i < bands.length; i++) {
      smoothed[i] += (bands[i] - smoothed[i]) * 0.15;
      const percent = smoothed[i] / 255;
      const barHeight = (canvas.height / 2) * percent;

      const x = i * barWidth;
      const yTop = (canvas.height / 2) - barHeight;
      const yBottom = (canvas.height / 2);

      ctx.fillStyle = "#dfdfdfff";
      ctx.fillRect(x, yTop, barWidth * 0.8, barHeight); 
      ctx.fillRect(x, yBottom, barWidth * 0.8, barHeight); 
    }

  } else if (visualizerMode === "sineWave") {
    analyzer.getByteTimeDomainData(data);

    const sliceWidth = canvas.width / data.length;
    const centerY = canvas.height / 2;
    ctx.lineWidth = 1.5;

    const layers = 3; 
    for (let l = 0; l < layers; l++) {
      ctx.beginPath();
      const alpha = 1 - l * 0.2;
      ctx.strokeStyle = `rgba(20, 90, 139, ${alpha})`;

      let x = 0;
      for (let i = 0; i < data.length; i++) {
        let v = (data[i] - 128) / 128.0;
        if (!sineSmoothed[i]) sineSmoothed[i] = 0;
        sineSmoothed[i] += (v - sineSmoothed[i]) * 1; 
        let y = centerY + v * (100 + l * 25);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }
      ctx.stroke();
    }

  } else if (visualizerMode === "honeycomb") {
    const bands = getEnergyBands(data, 60);
    const hexRadius = 30;
    const hexHeight = Math.sqrt(3) * hexRadius;
    let idx = 0;

    for (let row = 0; row < canvas.height / hexHeight + 2; row++) {
      for (let col = 0; col < canvas.width / (hexRadius * 1.5) + 2; col++) {
        const x = col * hexRadius * 1.5;
        const y = row * hexHeight + (col % 2 ? hexHeight / 2 : 0);

        const band = bands[idx % bands.length];
        const scale = band / 255;

        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI / 3 * i;
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

  animationId = requestAnimationFrame(draw);
}

async function decodeAudioFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  return await audioContext.decodeAudioData(arrayBuffer);
}

const fileInput = document.getElementById("fileInput");
const uploadLabel = document.getElementById("uploadLabel");

fileInput.onchange = async (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedBuffer = await decodeAudioFile(file);
    console.log("Loaded:", file.name);
    uploadLabel.textContent = "File uploaded ✔";
    setTimeout(() => {
      uploadLabel.textContent = "Upload File";
    }, 2000);
  }
};

const playButton = document.getElementById("play");
playButton.onclick = async () => {
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

const stopButton = document.getElementById("stop");
stopButton.onclick = () => {
  if (source) {
    source.stop();
    source.disconnect();
    source = null;
  }
  cancelAnimationFrame(animationId);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};

const barsModeButton = document.getElementById("barsMode");
const symBarsModeButton = document.getElementById("symBarsMode");
const waveModeButton = document.getElementById("waveMode");
const honeycombModeButton = document.getElementById("honeycombMode");

function setMode(mode) {
  visualizerMode = mode;
  console.log("Switched to", mode, "mode");

  smoothed = [];
  sineSmoothed = new Float32Array(512).fill(0);

  [barsModeButton, symBarsModeButton, waveModeButton, honeycombModeButton].forEach(btn => {
    btn.style.background = "#4f46e5";
  });

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
