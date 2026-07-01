const RAD = 180 / Math.PI;
const DEG = Math.PI / 180;

export const toRadians = (angle) => {
  return angle * DEG;
}

export const toDegrees = (angle) => {
  return angle * RAD;
}

export class Quaternion {
  constructor(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  setFromRotationMatrix4(matrix) {
    const te = matrix.elements;
    const m11 = te[0], m12 = te[4], m13 = te[8];
    const m21 = te[1], m22 = te[5], m23 = te[9];
    const m31 = te[2], m32 = te[6], m33 = te[10];
    const trace = m11 + m22 + m33;

    if (trace > 0) {
        const s = 0.5 / Math.sqrt(trace + 1.0);
        this.w = 0.25 / s;
        this.x = (m32 - m23) * s;
        this.y = (m13 - m31) * s;
        this.z = (m21 - m12) * s;
    } else if ((m11 > m22) && (m11 > m33)) {
        const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
        this.w = (m32 - m23) / s;
        this.x = 0.25 * s;
        this.y = (m12 + m21) / s;
        this.z = (m13 + m31) / s;
    } else if (m22 > m33) {
        const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
        this.w = (m13 - m31) / s;
        this.x = (m12 + m21) / s;
        this.y = 0.25 * s;
        this.z = (m23 + m32) / s;
    } else {
        const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
        this.w = (m21 - m12) / s;
        this.x = (m13 + m31) / s;
        this.y = (m23 + m32) / s;
        this.z = 0.25 * s;
    }
    return this;
  }

  fromRotationMatrix(m) {
    if (m.length !== 3 || m[0].length !== 3) {
        throw new Error("Input must be a 3x3 matrix.");
    }

    let trace = m[0][0] + m[1][1] + m[2][2];
    let w, x, y, z;

    if (trace > 0) {
        let s = Math.sqrt(1.0 + trace) * 2; // s=4*qw
        w = 0.25 * s;
        x = (m[2][1] - m[1][2]) / s;
        y = (m[0][2] - m[2][0]) / s;
        z = (m[1][0] - m[0][1]) / s;
    } else if ((m[0][0] > m[1][1]) && (m[0][0] > m[2][2])) {
        let s = Math.sqrt(1.0 + m[0][0] - m[1][1] - m[2][2]) * 2; // s=4*qx
        w = (m[2][1] - m[1][2]) / s;
        x = 0.25 * s;
        y = (m[0][1] + m[1][0]) / s;
        z = (m[0][2] + m[2][0]) / s;
    } else if (m[1][1] > m[2][2]) {
        let s = Math.sqrt(1.0 + m[1][1] - m[0][0] - m[2][2]) * 2; // s=4*qy
        w = (m[0][2] - m[2][0]) / s;
        x = (m[0][1] + m[1][0]) / s;
        y = 0.25 * s;
        z = (m[1][2] + m[2][1]) / s;
    } else {
        let s = Math.sqrt(1.0 + m[2][2] - m[0][0] - m[1][1]) * 2; // s=4*qz
        w = (m[1][0] - m[0][1]) / s;
        x = (m[0][2] + m[2][0]) / s;
        y = (m[1][2] + m[2][1]) / s;
        z = 0.25 * s;
    }
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  invert() {
    const normSq = this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z;
    this.x *= -1;
    this.y *= -1;
    this.z *= -1;
    this.x /= normSq;
    this.y /= normSq;
    this.z /= normSq;
    this.w /= normSq;
    return this;
  }

  multiply(q) {
    const x = this.w * q.x + this.x * q.w + this.y * q.z - this.z * q.y;
    const y = this.w * q.y - this.x * q.z + this.y * q.w + this.z * q.x;
    const z = this.w * q.z + this.x * q.y - this.y * q.x + this.z * q.w;
    const w = this.w * q.w - this.x * q.x - this.y * q.y - this.z * q.z;
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }

  static fromAxisAngle(axis, angle) {
    const halfAngle = 0.5 * angle;
    const sinHalfAngle = Math.sin(halfAngle);
    return new Quaternion(
        axis.x * sinHalfAngle,
        axis.y * sinHalfAngle,
        axis.z * sinHalfAngle,
        Math.cos(halfAngle),
    );
  }

  setFromEuler(euler) {
    const {x: pitch, y: yaw, z: roll} = euler;
    const qX = Quaternion.fromAxisAngle({x: 1, y: 0, z: 0}, pitch);
    const qY = Quaternion.fromAxisAngle({x: 0, y: 1, z: 0}, yaw);
    const qZ = Quaternion.fromAxisAngle({x: 0, y: 0, z: 1}, roll);
    this.copy(qY).multiply(qX).multiply(qZ);
    return this;
  }

  copy(q) {
    this.x = q.x;
    this.y = q.y;
    this.z = q.z;
    this.w = q.w;
    return this;
  }

  clone() {
    const q = new Quaternion(this.x, this.y, this.z, this.w);
    return q;
  }

  rotateX(angle) {
    const halfAngle = 0.5 * angle;
    const s = Math.sin(halfAngle);
    const c = Math.cos(halfAngle);
    const rotationQ = new Quaternion(s, 0, 0, c);
    return this.multiply(rotationQ);
  }

  rotateY(angle) {
    const halfAngle = 0.5 * angle;
    const s = Math.sin(halfAngle);
    const c = Math.cos(halfAngle);
    const rotationQ = new Quaternion(0, s, 0, c);
    return this.multiply(rotationQ);
  }

  rotateZ(angle) {
    const halfAngle = 0.5 * angle;
    const s = Math.sin(halfAngle);
    const c = Math.cos(halfAngle);
    const rotationQ = new Quaternion(0, 0, s, c);
    return this.multiply(rotationQ);
  }
}

export class Matrix4 {
  constructor() {
    this.elements = new Float32Array(16);
    this.identity();
  }

  identity() {
    const e = this.elements;
    e[0] = 1; e[4] = 0; e[8] = 0;  e[12] = 0;
    e[1] = 0; e[5] = 1; e[9] = 0;  e[13] = 0;
    e[2] = 0; e[6] = 0; e[10] = 1; e[14] = 0;
    e[3] = 0; e[7] = 0; e[11] = 0; e[15] = 1;
    return this;
  }

  makeRotationFromQuaternion(q) {
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const xx = x * x, yy = y * y, zz = z * z;
    const xy = x * y, xz = x * z, yz = y * z;
    const wx = w * x, wy = w * y, wz = w * z;

    const e = this.elements;

    e[0] = 1 - 2 * (yy + zz);
    e[1] = 2 * (xy + wz);
    e[2] = 2 * (xz - wy);
    e[3] = 0;

    e[4] = 2 * (xy - wz);
    e[5] = 1 - 2 * (xx + zz);
    e[6] = 2 * (yz + wx);
    e[7] = 0;

    e[8] = 2 * (xz + wy);
    e[9] = 2 * (yz - wx);
    e[10] = 1 - 2 * (xx + yy);
    e[11] = 0;

    e[12] = 0;
    e[13] = 0;
    e[14] = 0;
    e[15] = 1;

    return this;
  }

  copy(matrix) {
    for (let i = 0; i < 16; i++) {
      this.elements[i] = matrix.elements[i];
    }
    return this;
  }
}

export class Camera {
  static deviceList = new Map();

  cameraId = null;
  cameraLabel = null;

  static async Initialize(constraints = null) {
    if ('facingMode' in constraints && 'deviceId' in constraints) {
      throw new Error(`Camera settings 'deviceId' and 'facingMode' are mutually exclusive.`);
    }

    if ('facingMode' in constraints && ['environment', 'user'].indexOf( constraints.facingMode ) === -1) {
      throw new Error(`Camera settings 'facingMode' can only be 'environment' or 'user'.`);
    }

    const setupUserMediaStream = (permission) => {
      return new Promise((resolve, reject) => {
        const onSuccess = (stream) => {
          const track = stream.getVideoTracks()[0];

          if (typeof track === 'undefined') {
            reject(new Error(`Failed to access camera: Permission denied (No track).`));
          } else {
            const video = document.createElement('video');
            video.setAttribute('autoplay', 'autoplay');
            video.setAttribute('playsinline', 'playsinline');
            video.setAttribute('webkit-playsinline', 'webkit-playsinline');
            video.srcObject = stream;

            window.imStream = stream;

            video.onloadedmetadata = () => {
              const settings = track.getSettings();

              const tw = settings.width;
              const th = settings.height;
              const vw = video.videoWidth;
              const vh = video.videoHeight;

              if (vw !== tw || vh !== th) {
                console.warn(`Video dimensions mismatch: width: ${ tw }/${ vw }, height: ${ th }/${ vh }`);
              }

              video.style.width = vw + 'px';
              video.style.height = vh + 'px';
              video.width = vw;
              video.height = vh;
              video.play();

              navigator.mediaDevices.enumerateDevices()
              .then(deviceInfos => {
                for (let i = 0; i !== deviceInfos.length; ++i) {
                  const deviceInfo = deviceInfos[i];
                  if (deviceInfo.kind === 'videoinput') {
                    Camera.deviceList.set(deviceInfo.deviceId, deviceInfo.label);
                  }
                }

                const capabilities = track.getCapabilities();
                const deviceId = capabilities.deviceId;
                const deviceLabel = Camera.deviceList.get(deviceId);

                resolve(new Camera(video, deviceId, deviceLabel));
              });
            }
          }
        }

        const onFailure = (error) => {
          switch (error.name) {
            case 'NotFoundError':
            case 'DevicesNotFoundError':
              reject(new Error(`Failed to access camera: Camera not found.`));
              return;
            case 'SourceUnavailableError':
              reject(new Error(`Failed to access camera: Camera busy.`));
              return;
            case 'PermissionDeniedError':
            case 'SecurityError':
              reject(new Error(`Failed to access camera: Permission denied.`));
              return;
            default:
              reject(new Error(`Failed to access camera: Rejected.`));
              return;
          }
        }

        if (permission && permission.state === 'denied') {
          reject(new Error(`Failed to access camera: Permission denied.`));
          return;
        }

        navigator.mediaDevices.getUserMedia(constraints).then(onSuccess).catch(onFailure);
      });
    }

    if (navigator.permissions && navigator.permissions.query) {
      return navigator.permissions
      .query({name: 'camera'})
      .then((permission) => {
        return setupUserMediaStream(permission);
      })
      .catch(error => {
        console.error(error);
        return setupUserMediaStream();
      });
    } else {
      return setupUserMediaStream();
    }
  }

  constructor(videoElement, deviceId, deviceLabel) {
    this.el = videoElement;
    this.cameraId = deviceId;
    this.cameraLabel = deviceLabel;
    this.width = videoElement.videoWidth;
    this.height = videoElement.videoHeight;

    this._canvas = createCanvas(this.width, this.height);
    this._ctx = this._canvas.getContext('2d', {alpha: false, desynchronized: true, willReadFrequently: true});
  }

  getImageData(scale = 1.0) {
    const w = scale * this.width;
    const h = scale * this.height;
    this._canvas.width = w;
    this._canvas.height = h;
    this._ctx.drawImage(this.el, 0, 0, w, h);
    return this._ctx.getImageData(0, 0, w, h).data;
  }

  dispose() {
    if (typeof window.imStream !== 'undefined') {
      window.imStream.getTracks().forEach(track => {
        track.stop();
      });
      window.imStream = null;
    }

    if (this.el?.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }

    this.el = null;
    this._ctx = null;
    this._canvas = null;
  }
}

const createCanvas = (width, height) => {
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  return canvas;
}

export const deviceDetection = new Promise((resolve, reject ) => {
  const s = document.createElement('script');
  s.setAttribute('async', 'async');
  s.setAttribute('src', 'https://cloud.51degrees.com/api/v4/AQSwXfE41-Sj311c3Eg.js');
  s.onload = () => {
    window.fod.complete(resolve);
  };
  s.onerror = reject;
  document.body.appendChild(s);
});