import { default as posePluginModule } from "./PosePlugin.js";

let Module;

posePluginModule().then(instance => {
  Module = instance;

  self.icvLoadMap = Module.cwrap('icvLoadMap', 'number', ['number']);
  self.icvFreeMap = Module.cwrap('icvFreeMap', 'number', ['number']);
  self.icvPointsGet = Module.cwrap('icvPointsGet', 'number', ['number', 'number', 'number']);
  self.icvPointsGetCount = Module.cwrap('icvPointsGetCount', 'number', ['number']);
  self.icvLocalize = Module.cwrap('wasmLocalize', 'number', ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'array']);
  self.icvValidateUser = Module.cwrap('icvValidateUser', 'number', ['string']);
  self.icvValidateSession = Module.cwrap('icvValidateSession', 'number', ['string']);
  self.icvPosMapToEcef = Module.cwrap('icvPosMapToEcef', 'number', ['number', 'number', 'array']);
  self.icvPosEcefToWgs84 = Module.cwrap('icvPosEcefToWgs84', 'number', ['number', 'number']);
  self.icvPosWgs84ToEcef = Module.cwrap('icvPosWgs84ToEcef', 'number', ['number', 'number']);
  self.icvPosEcefToMap = Module.cwrap('icvPosEcefToMap', 'number', ['number', 'number', 'number']);
  self.icvRotMapToEcef = Module.cwrap('icvRotMapToEcef', 'number', ['number', 'number', 'array']);
  self.icvRotEcefToMap = Module.cwrap('icvRotEcefToMap', 'number', ['number', 'number', 'number']);

  postMessage({type: "Init", data: []});
}).catch(error => {
  console.error('Error initializing WebAssembly module:', error);
});

onmessage = (e) => {
  const { type, data } = e.data;

  if (type === "LoadMap") {
    const map = data;
    const ptrMap = Module._malloc(map.length * map.BYTES_PER_ELEMENT);
    Module.HEAPU8.set(map, ptrMap);
    let r = self.icvLoadMap(ptrMap);
    Module._free(ptrMap);
    postMessage({type: "LoadMap", data: r});
  }
  else if (type === "FreeMap") {
    let r = self.icvFreeMap(data);
    postMessage({type: "FreeMap", data: r});
  }
  else if (type === "ValidateUser") {
    let r = self.icvValidateUser(data);
    postMessage({type: "ValidateUser", data: r});
  }
  else if (type === "Localize") {
    const width = data[0];
    const height = data[1];
    const channels = data[2];
    const intrinsics = new Float32Array(data[3]);
    const pixels = data[4];
    const time = data[5];
    const solverType = data[6];
    const camRot = new Float32Array(data[7]);
    const mapDict = data[8];

    const position = new Float32Array(3);
    const rotation = new Float32Array(4);
    const ecefPos = new Float64Array(3);
    const ecefRot = new Float64Array(4);
    const wgs84Pos = new Float64Array(3);

    const ptrPix = Module._malloc(pixels.length * pixels.BYTES_PER_ELEMENT);
    Module.HEAPU8.set(pixels, ptrPix);
    const ptrPos = Module._malloc(position.length * position.BYTES_PER_ELEMENT);
    Module.HEAPF32.set(position, ptrPos >> 2);
    const ptrRot = Module._malloc(rotation.length * rotation.BYTES_PER_ELEMENT);
    Module.HEAPF32.set(rotation, ptrRot >> 2);
    const ptrIntrinsics = Module._malloc(intrinsics.length * intrinsics.BYTES_PER_ELEMENT);
    Module.HEAPF32.set(intrinsics, ptrIntrinsics >> 2);
    const ptrEcefPos = Module._malloc(ecefPos.length * ecefPos.BYTES_PER_ELEMENT);
    Module.HEAPF64.set(ecefPos, ptrEcefPos >> 3);
    const ptrEcefRot = Module._malloc(ecefRot.length * ecefRot.BYTES_PER_ELEMENT);
    Module.HEAPF64.set(ecefRot, ptrEcefRot >> 3);
    const ptrWgs84Pos = Module._malloc(wgs84Pos.length * wgs84Pos.BYTES_PER_ELEMENT);
    Module.HEAPF64.set(wgs84Pos, ptrWgs84Pos >> 3);

    const r = self.icvLocalize(ptrPos, ptrRot, width, height, ptrIntrinsics, ptrPix, channels, solverType, new Uint8Array(camRot.buffer));

    if (r >= 0) {
      position.set( Module.HEAPF32.subarray(ptrPos >> 2, (ptrPos >> 2) + position.length) );
      rotation.set( Module.HEAPF32.subarray(ptrRot >> 2, (ptrRot >> 2) + rotation.length) );
      intrinsics.set( Module.HEAPF32.subarray(ptrIntrinsics >> 2, (ptrIntrinsics >> 2) + intrinsics.length) );

      const mapData = mapDict[r];
      const mapToEcef = new Float64Array(mapData.mapToEcef);
      let ret = self.icvPosMapToEcef(ptrEcefPos, ptrPos, new Uint8Array(mapToEcef.buffer));
      if (ret === 0) {
        ecefPos.set( Module.HEAPF64.subarray(ptrEcefPos >> 3, (ptrEcefPos >> 3) + ecefPos.length) );
        ret = self.icvPosEcefToWgs84(ptrWgs84Pos, ptrEcefPos);
        if (ret === 0) {
          wgs84Pos.set( Module.HEAPF64.subarray(ptrWgs84Pos >> 3, (ptrWgs84Pos >> 3) + wgs84Pos.length) );
        }
      }
      ret = self.icvRotMapToEcef(ptrEcefRot, ptrRot, new Uint8Array(mapToEcef.buffer));
      if (ret === 0) {
        ecefRot.set( Module.HEAPF64.subarray(ptrEcefRot >> 3, (ptrEcefRot >> 3) + ecefRot.length) );
      }

      // TODO: add compass heading
    }

    const pos = Array.from(position);
    const rot = Array.from(rotation);
    const wgs84 = Array.from(wgs84Pos);
    const focalLen = intrinsics[0];

    Module._free(ptrPix);
    Module._free(ptrPos);
    Module._free(ptrRot);
    Module._free(ptrIntrinsics);
    Module._free(ptrEcefPos);
    Module._free(ptrEcefRot);
    Module._free(ptrWgs84Pos);

    postMessage({type: "Localize", data: {r: r, pos: pos, rot: rot, time: time, focalLength: focalLen, wgs84: wgs84}});
  }
}