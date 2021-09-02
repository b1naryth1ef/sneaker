const toRad = (n: number) => {
  return n * Math.PI / 180;
};

const toDeg = (rad: number) => rad * 180 / Math.PI;

export function computeBRAA(
  lat1: number,
  lon1: number,
  brng: number,
  dist: number,
): [number, number] {
  var a = 6378137,
    b = 6356752.3142,
    f = 1 / 298.257223563, // WGS-84 ellipsiod
    s = dist,
    alpha1 = toRad(brng),
    sinAlpha1 = Math.sin(alpha1),
    cosAlpha1 = Math.cos(alpha1),
    tanU1 = (1 - f) * Math.tan(toRad(lat1)),
    cosU1 = 1 / Math.sqrt((1 + tanU1 * tanU1)),
    sinU1 = tanU1 * cosU1,
    sigma1 = Math.atan2(tanU1, cosAlpha1),
    sinAlpha = cosU1 * sinAlpha1,
    cosSqAlpha = 1 - sinAlpha * sinAlpha,
    uSq = cosSqAlpha * (a * a - b * b) / (b * b),
    A = 1 + uSq / 16384 * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq))),
    B = uSq / 1024 * (256 + uSq * (-128 + uSq * (74 - 47 * uSq))),
    sigma = s / (b * A),
    sigmaP = 2 * Math.PI;

  let sinSigma: number = 0;
  let cosSigma: number = 0;
  let cos2SigmaM = 0;

  while (Math.abs(sigma - sigmaP) > 1e-12) {
    sinSigma = Math.sin(sigma);
    cosSigma = Math.cos(sigma);
    cos2SigmaM = Math.cos(2 * sigma1 + sigma);

    var deltaSigma = B * sinSigma *
      (cos2SigmaM +
        B / 4 *
          (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
            B / 6 * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) *
              (-3 + 4 * cos2SigmaM * cos2SigmaM)));
    sigmaP = sigma;
    sigma = s / (b * A) + deltaSigma;
  }

  var tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1,
    lat2 = Math.atan2(
      sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
      (1 - f) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp),
    ),
    lambda = Math.atan2(
      sinSigma * sinAlpha1,
      cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1,
    ),
    C = f / 16 * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha)),
    L = lambda -
      (1 - C) * f * sinAlpha *
        (sigma +
          C * sinSigma *
            (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM))),
    revAz = Math.atan2(sinAlpha, -tmp); // final bearing
  return [toDeg(lat2), lon1 + toDeg(L)];
}

function radians(n: number) {
  return n * (Math.PI / 180);
}
function degrees(n: number) {
  return n * (180 / Math.PI);
}

export function getBearing(
  [startLat, startLong]: [number, number],
  [endLat, endLong]: [number, number],
) {
  startLat = radians(startLat);
  startLong = radians(startLong);
  endLat = radians(endLat);
  endLong = radians(endLong);

  var dLong = endLong - startLong;

  var dPhi = Math.log(
    Math.tan(endLat / 2.0 + Math.PI / 4.0) /
      Math.tan(startLat / 2.0 + Math.PI / 4.0),
  );
  if (Math.abs(dLong) > Math.PI) {
    if (dLong > 0.0) {
      dLong = -(2.0 * Math.PI - dLong);
    } else {
      dLong = (2.0 * Math.PI + dLong);
    }
  }

  return (degrees(Math.atan2(dLong, dPhi)) + 360.0) % 360.0;
}

export function getCardinal(angle: number) {
  const degreePerDirection = 360 / 8;
  const offsetAngle = angle + degreePerDirection / 2;

  return (offsetAngle >= 0 * degreePerDirection &&
      offsetAngle < 1 * degreePerDirection)
    ? "N"
    : (offsetAngle >= 1 * degreePerDirection &&
        offsetAngle < 2 * degreePerDirection)
    ? "NE"
    : (offsetAngle >= 2 * degreePerDirection &&
        offsetAngle < 3 * degreePerDirection)
    ? "E"
    : (offsetAngle >= 3 * degreePerDirection &&
        offsetAngle < 4 * degreePerDirection)
    ? "SE"
    : (offsetAngle >= 4 * degreePerDirection &&
        offsetAngle < 5 * degreePerDirection)
    ? "S"
    : (offsetAngle >= 5 * degreePerDirection &&
        offsetAngle < 6 * degreePerDirection)
    ? "SW"
    : (offsetAngle >= 6 * degreePerDirection &&
        offsetAngle < 7 * degreePerDirection)
    ? "W"
    : "NW";
}

export function getFlyDistance(
  [lat1, lon1]: [number, number],
  [lat2, lon2]: [number, number],
) {
  var R = 6371; // km
  var dLat = toRad(lat2 - lat1);
  var dLon = toRad(lon2 - lon1);
  lat1 = toRad(lat1);
  lat2 = toRad(lat2);

  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;
  return d * 0.539957;
}

export function formatCounter(
  seconds: number,
): string {
  const hours = Math.floor(seconds / 3600),
    minutes = Math.floor((seconds - (hours * 3600)) / 60),
    outSeconds = seconds - (hours * 3600) - (minutes * 60);

  return `${hours.toString().padStart(2, "0")}:${
    minutes.toString().padStart(2, "0")
  }:${outSeconds.toString().padStart(2, "0")}`;
}
