import * as THREE from "./three/three.module.js";

export function Pentacentric() {
  var group;
  var analyser;
  var view;
  var scene;

  var bufferLength;
  var dataArray;
  var visualArray;
  var fsize = 4096;
  var numBars = 32;

  var mesh;

  var vertexShader = [
    "void main() {",
    "   gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
    "}",
  ].join("\n");

  var fragmentShader = [
    "uniform vec3 col;",
    "uniform float alpha;",
    "void main() {",
    "   gl_FragColor = vec4( col.r, col.g, col.b, alpha );",
    "}",
  ].join("\n");

  var pentacentric = {
    name: "Pentacentric",
    init: function (Analyser, View) {
      analyser = Analyser.analyser;
      view = View;
      scene = View.scene;
    },
    make: function () {
      group = new THREE.Object3D();

      analyser.fftSize = fsize;
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);

      view.usePerspectiveCamera();
      view.camera.position.y = 0;

      var positionZ = 498;

      for (var i = 0; i < numBars; i++) {
        var geometry = new THREE.CylinderGeometry(20, 20, 2, 5, 1, true);

        var uniforms = {
          col: { value: new THREE.Color("hsl(200, 100%, 70%)") },
          alpha: { value: 1 },
        };

        var material = new THREE.ShaderMaterial({
          uniforms: uniforms,
          vertexShader: vertexShader,
          fragmentShader: fragmentShader,
          side: THREE.DoubleSide,
        });

        mesh = new THREE.Mesh(geometry, material);
        mesh.position.z = positionZ;
        mesh.rotation.x = Math.PI / 2;

        positionZ -= 5;
        group.add(mesh);
      }

      scene.add(group);

      this.group = group;
    },
    destroy: function () {
      scene.remove(group);
    },
    render: function () {
      analyser.getByteFrequencyData(dataArray);

      visualArray = [];
      var step = Math.floor(dataArray.length / numBars);
      for (var i = 0; i < numBars; i++) {
        let sum = 0;
        for (var j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        visualArray.push(sum / step);
      }

      var avg = arrayAverage(visualArray);
      view.camera.rotation.z += avg <= 1 ? 0 : Math.pow(avg / 8192 + 1, 2) - 1;

      if (group) {
        for (var i = 0; i < visualArray.length; i++) {
          setUniformColor(
            i,
            308 - visualArray[i],
            parseInt((avg / 255) * 40) + 60,
            parseInt((visualArray[i] / 255) * 25) + 45,
            visualArray[i]
          );
          group.children[i].scale.x =
            (visualArray[i] / 255) * (avg / 255) + 0.25 * 2;
          group.children[i].scale.y =
            (visualArray[i] / 255) * (avg / 255) + 0.25 * 2;
          group.children[i].scale.z =
            (visualArray[i] / 255) * (avg / 255) + 0.25 * 2;
        }
      }
    },
  };

  function setUniformColor(groupI, h, s, l, factor) {
    group.children[groupI].material.uniforms.col.value = new THREE.Color(
      "hsl(" + h + ", " + s + "%, " + l + "%)"
    );
    group.children[groupI].material.uniforms.alpha.value = s / 100;
  }

  function arrayAverage(arr) {
    var sum = 0;
    for (var i = 0; i < arr.length; i++) {
      sum += arr[i];
    }
    return sum / arr.length;
  }

  return pentacentric;
}
