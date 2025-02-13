var WindFlowGLSL;
/******/ (function() { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 41:
/***/ (function(module) {

module.exports = "// the size of UV textures: width = lon, height = lat*lev\r\nuniform sampler2D U; // eastward wind \r\nuniform sampler2D V; // northward wind\r\nuniform sampler2D W; // upward wind\r\nuniform sampler2D currentParticlesPosition; // (lon, lat, lev)\r\n\r\nuniform vec3 dimension; // (lon, lat, lev)\r\nuniform vec3 minimum; // minimum of each dimension\r\nuniform vec3 maximum; // maximum of each dimension\r\nuniform vec3 interval; // interval of each dimension\r\n\r\n// used to calculate the wind norm\r\nuniform vec2 uSpeedRange; // (min, max);\r\nuniform vec2 vSpeedRange;\r\nuniform vec2 wSpeedRange;\r\nuniform float pixelSize;\r\nuniform float speedFactor;\r\n\r\nfloat speedScaleFactor;\r\n\r\nvarying vec2 v_textureCoordinates;\r\n\r\nvec2 mapPositionToNormalizedIndex2D(vec3 lonLatLev) {\r\n    // ensure the range of longitude and latitude\r\n    lonLatLev.x = clamp(lonLatLev.x, minimum.x, maximum.x);\r\n    lonLatLev.y = clamp(lonLatLev.y,  minimum.y, maximum.y);\r\n    lonLatLev.z = clamp(lonLatLev.z,  minimum.z, maximum.z);\r\n\r\n    vec3 index3D = vec3(0.0);\r\n    index3D.x = (lonLatLev.x - minimum.x) / interval.x;\r\n    index3D.y = (lonLatLev.y - minimum.y) / interval.y;\r\n    // map the z-axis value to the nearest bit plane to ensure that the result is an integer\r\n    index3D.z = ceil((lonLatLev.z - minimum.z) / interval.z); \r\n\r\n    // the st texture coordinate corresponding to (col, row) index\r\n    // example\r\n    // data array is [0, 1, 2, 3, 4, 5, 7, 8, 9], width = 2, height = 2, level = 2\r\n    // the content of texture will be\r\n    // t 1.0\r\n    //    |  6 7\r\n    //    |  4 5\r\n    //    |  2 3\r\n    //    |  0 1\r\n    //   0.0------1.0 s\r\n\r\n    vec2 index2D = vec2(index3D.x, index3D.z * dimension.y + index3D.y);\r\n    vec2 normalizedIndex2D = vec2(index2D.x / dimension.x, index2D.y / (dimension.y * dimension.z));\r\n    return normalizedIndex2D;\r\n}\r\n\r\nfloat getWindComponent(sampler2D componentTexture, vec3 lonLatLev) {\r\n    vec2 normalizedIndex2D = mapPositionToNormalizedIndex2D(lonLatLev);\r\n    float result = texture2D(componentTexture, normalizedIndex2D).r;\r\n    return result;\r\n}\r\n\r\nfloat interpolateTexture(sampler2D componentTexture, vec3 lonLatLev) {\r\n    float lon = lonLatLev.x;\r\n    float lat = lonLatLev.y;\r\n    float lev = lonLatLev.z;\r\n\r\n    float lon0 = floor(lon / interval.x) * interval.x;\r\n    float lon1 = lon0 + 1.0 * interval.x;\r\n    float lat0 = floor(lat / interval.y) * interval.y;\r\n    float lat1 = lat0 + 1.0 * interval.y;\r\n\r\n    float lon0_lat0 = getWindComponent(componentTexture, vec3(lon0, lat0, lev));\r\n    float lon1_lat0 = getWindComponent(componentTexture, vec3(lon1, lat0, lev));\r\n    float lon0_lat1 = getWindComponent(componentTexture, vec3(lon0, lat1, lev));\r\n    float lon1_lat1 = getWindComponent(componentTexture, vec3(lon1, lat1, lev));\r\n\r\n    float lon_lat0 = mix(lon0_lat0, lon1_lat0, lon - lon0);\r\n    float lon_lat1 = mix(lon0_lat1, lon1_lat1, lon - lon0);\r\n    float lon_lat = mix(lon_lat0, lon_lat1, lat - lat0);\r\n    return lon_lat;\r\n}\r\n\r\nvec3 linearInterpolation(vec3 lonLatLev) {\r\n    // https://en.wikipedia.org/wiki/Bilinear_interpolation\r\n    float u = interpolateTexture(U, lonLatLev);\r\n    float v = interpolateTexture(V, lonLatLev);\r\n    float w = interpolateTexture(W, lonLatLev);\r\n    return vec3(u, v, w);\r\n}\r\n\r\nvec2 lengthOfLonLat(vec3 lonLatLev) {\r\n    // unit conversion: meters -> longitude latitude degrees\r\n    // see https://en.wikipedia.org/wiki/Geographic_coordinate_system#Length_of_a_degree for detail\r\n\r\n    // Calculate the length of a degree of latitude and longitude in meters\r\n    float latitude = radians(lonLatLev.y);\r\n\r\n    float term1 = 111132.92;\r\n    float term2 = 559.82 * cos(2.0 * latitude);\r\n    float term3 = 1.175 * cos(4.0 * latitude);\r\n    float term4 = 0.0023 * cos(6.0 * latitude);\r\n    float latLength = term1 - term2 + term3 - term4;\r\n\r\n    float term5 = 111412.84 * cos(latitude);\r\n    float term6 = 93.5 * cos(3.0 * latitude);\r\n    float term7 = 0.118 * cos(5.0 * latitude);\r\n    float longLength = term5 - term6 + term7;\r\n\r\n    return vec2(longLength, latLength);\r\n}\r\n\r\nvec3 convertSpeedUnitToLonLat(vec3 lonLatLev, vec3 speed) {\r\n    vec2 lonLatLength = lengthOfLonLat(lonLatLev);\r\n    float u = speed.x / lonLatLength.x;\r\n    float v = speed.y / lonLatLength.y;\r\n    float w = speed.z;\r\n    vec3 windVectorInLonLatLev = vec3(u, v, w);\r\n\r\n    return windVectorInLonLatLev;\r\n}\r\n\r\nvec3 calculateSpeedByRungeKutta2(vec3 lonLatLev) {\r\n    // see https://en.wikipedia.org/wiki/Runge%E2%80%93Kutta_methods#Second-order_methods_with_two_stages for detail\r\n    const float h = 0.5;\r\n\r\n    vec3 y_n = lonLatLev;\r\n    vec3 f_n = linearInterpolation(lonLatLev);\r\n    vec3 midpoint = y_n + 0.5 * h * convertSpeedUnitToLonLat(y_n, f_n) * speedScaleFactor;\r\n    vec3 speed = h * linearInterpolation(midpoint) * speedScaleFactor;\r\n\r\n    return speed;\r\n}\r\n\r\nvec2 getRange(vec2 range) {\r\n  float x1 = 0.0 - range.x;\r\n  float x2 = range.y - 0.0;\r\n  if(x1 < 0.0 || x2 < 0.0){\r\n    return vec2(abs(x1), abs(x2));\r\n  } else {\r\n    return vec2(0.0, abs(max(x1, x2)));\r\n  }\r\n}\r\n\r\nfloat calculateWindNorm(vec3 speed) {\r\n    vec3 percent = vec3(0.0);\r\n    vec2 uRange = getRange(uSpeedRange);\r\n    vec2 vRange = getRange(vSpeedRange);\r\n    vec2 wRange = getRange(wSpeedRange);\r\n    if(length(speed.xyz) == 0.0){\r\n      return 0.0;\r\n      return 0.0;\r\n    }\r\n\r\n    percent.x = (abs(speed.x) - uRange.x) / (uRange.y - uRange.x);\r\n    percent.y = (abs(speed.y) - vRange.x) / (vRange.y - vRange.x);\r\n    if(wSpeedRange.y == wSpeedRange.x){\r\n      percent.z = 0.0;\r\n    } else {\r\n      percent.z = (abs(speed.z) - wRange.x) / (wRange.y - wRange.x);\r\n    }\r\n    //float norm = length(percent);\r\n    float norm = length(speed); // 用原始值\r\n\r\n    return norm;\r\n}\r\n\r\nvoid main() {\r\n    speedScaleFactor = speedFactor * pixelSize;\r\n    // texture coordinate must be normalized\r\n    vec3 lonLatLev = texture2D(currentParticlesPosition, v_textureCoordinates).rgb;\r\n    vec3 speedOrigin = linearInterpolation(lonLatLev);\r\n    vec3 speed = calculateSpeedByRungeKutta2(lonLatLev);\r\n    vec3 speedInLonLat = convertSpeedUnitToLonLat(lonLatLev, speed);\r\n\r\n    vec4 particleSpeed = vec4(speedInLonLat, calculateWindNorm(speed / speedScaleFactor));\r\n    // gl_FragColor = particleSpeed;\r\n    gl_FragColor = vec4(speedInLonLat, calculateWindNorm(speedOrigin));\r\n}"

/***/ }),

/***/ 650:
/***/ (function(module) {

module.exports = "attribute vec3 position;\r\nattribute vec2 st;\r\n\r\nvarying vec2 textureCoordinate;\r\n\r\nvoid main() {\r\n    textureCoordinate = st;\r\n    gl_Position = vec4(position, 1.0);\r\n}"

/***/ }),

/***/ 391:
/***/ (function(module) {

module.exports = "uniform sampler2D nextParticlesPosition;\r\nuniform sampler2D particlesSpeed; // (u, v, w, norm)\r\n\r\nuniform sampler2D H; // particles height textures\r\n\r\nuniform vec3 dimension; // (lon, lat, lev)\r\nuniform vec3 minimum; // minimum of each dimension\r\nuniform vec3 maximum; // maximum of each dimension\r\nuniform vec3 interval; // interval of each dimension\r\n\r\n// range (min, max)\r\nuniform vec2 lonRange;\r\nuniform vec2 latRange;\r\nuniform vec2 viewerLonRange;\r\nuniform vec2 viewerLatRange;\r\n\r\nuniform float randomCoefficient; // use to improve the pseudo-random generator\r\nuniform float dropRate; // drop rate is a chance a particle will restart at random position to avoid degeneration\r\nuniform float dropRateBump;\r\n\r\nvarying vec2 v_textureCoordinates;\r\n\r\nvec2 mapPositionToNormalizedIndex2D(vec3 lonLatLev) {\r\n    // ensure the range of longitude and latitude\r\n    lonLatLev.x = clamp(lonLatLev.x, minimum.x, maximum.x);\r\n    lonLatLev.y = clamp(lonLatLev.y,  minimum.y, maximum.y);\r\n    lonLatLev.z = clamp(lonLatLev.z,  minimum.z, maximum.z);\r\n\r\n    vec3 index3D = vec3(0.0);\r\n    index3D.x = (lonLatLev.x - minimum.x) / interval.x;\r\n    index3D.y = (lonLatLev.y - minimum.y) / interval.y;\r\n    index3D.z = ceil((lonLatLev.z - minimum.z) / interval.z); \r\n\r\n    vec2 index2D = vec2(index3D.x, index3D.z * dimension.y + index3D.y);\r\n    vec2 normalizedIndex2D = vec2(index2D.x / dimension.x, index2D.y / (dimension.y * dimension.z));\r\n    return normalizedIndex2D;\r\n}\r\n\r\nvec4 getTextureValue(sampler2D componentTexture, vec3 lonLatLev) {\r\n    vec2 normalizedIndex2D = mapPositionToNormalizedIndex2D(lonLatLev);\r\n    vec4 result = texture2D(componentTexture, normalizedIndex2D);\r\n    return result;\r\n}\r\n\r\n// pseudo-random generator\r\nconst vec3 randomConstants = vec3(12.9898, 78.233, 4375.85453);\r\nconst vec2 normalRange = vec2(0.0, 1.0);\r\nfloat rand(vec2 seed, vec2 range) {\r\n    vec2 randomSeed = randomCoefficient * seed;\r\n    float temp = dot(randomConstants.xy, randomSeed);\r\n    temp = fract(sin(temp) * (randomConstants.z + temp));\r\n    return temp * (range.y - range.x) + range.x;\r\n}\r\n\r\nbool particleNoSpeed(vec3 particle) {\r\n    vec4 speed = getTextureValue(particlesSpeed, particle);\r\n    return speed.r == 0.0 && speed.g == 0.0;\r\n}\r\n\r\nvec3 generateRandomParticle(vec2 seed, float lev) {\r\n    // ensure the longitude is in [0, 360]\r\n    float randomLon = mod(rand(seed, lonRange), 360.0);\r\n    float randomLat = rand(-seed, latRange);\r\n    \r\n    float height = getTextureValue(H, vec3(randomLon, randomLat, lev)).r;\r\n\r\n    return vec3(randomLon, randomLat, height);\r\n}\r\n\r\nbool particleOutbound(vec3 particle) {\r\n    return particle.y < viewerLatRange.x || particle.y > viewerLatRange.y || particle.x < viewerLonRange.x || particle.x > viewerLonRange.y;\r\n}\r\n\r\nvoid main() {\r\n    vec3 nextParticle = texture2D(nextParticlesPosition, v_textureCoordinates).rgb;\r\n    vec4 nextSpeed = texture2D(particlesSpeed, v_textureCoordinates);\r\n    float speedNorm = nextSpeed.a;\r\n    float particleDropRate = dropRate + dropRateBump * speedNorm;\r\n\r\n    vec2 seed1 = nextParticle.xy + v_textureCoordinates;\r\n    vec2 seed2 = nextSpeed.xy + v_textureCoordinates;\r\n    vec3 randomParticle = generateRandomParticle(seed1, nextParticle.z);\r\n    float randomNumber = rand(seed2, normalRange);\r\n\r\n    if (randomNumber < particleDropRate || particleOutbound(nextParticle)) {\r\n        gl_FragColor = vec4(randomParticle, 1.0); // 1.0 means this is a random particle\r\n    } else {\r\n        gl_FragColor = vec4(nextParticle, 0.0);\r\n    }\r\n}"

/***/ }),

/***/ 165:
/***/ (function(module) {

module.exports = "uniform sampler2D trailsColorTexture;\r\nuniform sampler2D trailsDepthTexture;\r\n\r\nvarying vec2 textureCoordinate;\r\n\r\nvoid main() {\r\n    vec4 trailsColor = texture2D(trailsColorTexture, textureCoordinate);\r\n    float trailsDepth = texture2D(trailsDepthTexture, textureCoordinate).r;\r\n    float globeDepth = czm_unpackDepth(texture2D(czm_globeDepthTexture, textureCoordinate));\r\n\r\n    if (trailsDepth < globeDepth) {\r\n        gl_FragColor = trailsColor;\r\n    } else {\r\n        gl_FragColor = vec4(0.0);\r\n    }\r\n}"

/***/ }),

/***/ 918:
/***/ (function(module) {

module.exports = "varying float heightNormalization;\r\nuniform sampler2D colorTable;\r\nuniform bool colour;\r\n\r\nvarying float speedNormalization;\r\n\r\nvoid main() {\r\n  if(speedNormalization > 0.0){\r\n    /*if(colour){\r\n      gl_FragColor = texture2D(colorTable, vec2(heightNormalization, 0.0));\r\n    } else {\r\n      gl_FragColor = texture2D(colorTable, vec2(speedNormalization, 0.0));\r\n    }*/\r\n\r\n    //色例配置\r\n    if(speedNormalization>0.0 && speedNormalization<5.0){\r\n       gl_FragColor =  vec4(1.0,0.0,0.0,1.0);\r\n    } else if(speedNormalization>=5.0 && speedNormalization<10.0){\r\n        gl_FragColor =  vec4(0.0,1.0,0.0,1.0);\r\n    } else if(speedNormalization>=10.0 && speedNormalization<15.0){\r\n        gl_FragColor =  vec4(0.0,0.0,1.0,1.0);\r\n    } else {\r\n        gl_FragColor =  vec4(1.0,0.0,1.0,1.0);\r\n    } \r\n\r\n  } else {\r\n    gl_FragColor = vec4(0.0);\r\n  }\r\n}"

/***/ }),

/***/ 473:
/***/ (function(module) {

module.exports = "attribute vec2 st;\r\n// it is not normal itself, but used to control lines drawing\r\nattribute vec3 normal; // (point to use, offset sign, not used component)\r\nuniform vec2 hRange;\r\nuniform vec2 uSpeedRange; // (min, max);\r\nuniform vec2 vSpeedRange;\r\nuniform vec2 wSpeedRange;\r\n\r\nuniform sampler2D previousParticlesPosition;\r\nuniform sampler2D currentParticlesPosition;\r\nuniform sampler2D postProcessingPosition;\r\nuniform sampler2D particlesSpeed;\r\n\r\nuniform float particleHeight;\r\n\r\nuniform float aspect;\r\nuniform float pixelSize;\r\nuniform float lineWidth;\r\n\r\nstruct adjacentPoints {\r\n    vec4 previous;\r\n    vec4 current;\r\n    vec4 next;\r\n};\r\n\r\nvarying float heightNormalization;\r\nvarying float speedNormalization;\r\nvec3 convertCoordinate(vec3 lonLatLev) {\r\n    // WGS84 (lon, lat, lev) -> ECEF (x, y, z)\r\n    // read https://en.wikipedia.org/wiki/Geographic_coordinate_conversion#From_geodetic_to_ECEF_coordinates for detail\r\n\r\n    // WGS 84 geometric constants \r\n    float a = 6378137.0; // Semi-major axis \r\n    float b = 6356752.3142; // Semi-minor axis \r\n    float e2 = 6.69437999014e-3; // First eccentricity squared\r\n\r\n    float latitude = radians(lonLatLev.y);\r\n    float longitude = radians(lonLatLev.x);\r\n\r\n    float cosLat = cos(latitude);\r\n    float sinLat = sin(latitude);\r\n    float cosLon = cos(longitude);\r\n    float sinLon = sin(longitude);\r\n\r\n    float N_Phi = a / sqrt(1.0 - e2 * sinLat * sinLat);\r\n    float h = particleHeight + lonLatLev.z; // it should be high enough otherwise the particle may not pass the terrain depth test\r\n    vec3 cartesian = vec3(0.0);\r\n    cartesian.x = (N_Phi + h) * cosLat * cosLon;\r\n    cartesian.y = (N_Phi + h) * cosLat * sinLon;\r\n    cartesian.z = ((b * b) / (a * a) * N_Phi + h) * sinLat;\r\n    return cartesian;\r\n}\r\n\r\nvec4 calculateProjectedCoordinate(vec3 lonLatLev) {\r\n    // the range of longitude in Cesium is [-180, 180] but the range of longitude in the NetCDF file is [0, 360]\r\n    // [0, 180] is corresponding to [0, 180] and [180, 360] is corresponding to [-180, 0]\r\n    lonLatLev.x = mod(lonLatLev.x + 180.0, 360.0) - 180.0;\r\n    vec3 particlePosition = convertCoordinate(lonLatLev);\r\n    vec4 projectedCoordinate = czm_modelViewProjection * vec4(particlePosition, 1.0);\r\n    return projectedCoordinate;\r\n}\r\n\r\nvec4 calculateOffsetOnNormalDirection(vec4 pointA, vec4 pointB, float offsetSign) {\r\n    vec2 aspectVec2 = vec2(aspect, 1.0);\r\n    vec2 pointA_XY = (pointA.xy / pointA.w) * aspectVec2;\r\n    vec2 pointB_XY = (pointB.xy / pointB.w) * aspectVec2;\r\n\r\n    float offsetLength = lineWidth / 2.0;\r\n    vec2 direction = normalize(pointB_XY - pointA_XY);\r\n    vec2 normalVector = vec2(-direction.y, direction.x);\r\n    normalVector.x = normalVector.x / aspect;\r\n    normalVector = offsetLength * normalVector;\r\n\r\n    vec4 offset = vec4(offsetSign * normalVector, 0.0, 0.0);\r\n    return offset;\r\n}\r\n\r\nfloat calculateWindNorm(vec3 speed) {\r\n    vec3 percent = vec3(0.0);\r\n    percent.x = (speed.x - uSpeedRange.x) / (uSpeedRange.y - uSpeedRange.x);\r\n    percent.y = (speed.y - vSpeedRange.x) / (vSpeedRange.y - vSpeedRange.x);\r\n    if(wSpeedRange.y == wSpeedRange.x){\r\n      percent.z = 0.0;\r\n    } else {\r\n      percent.z = (speed.z - wSpeedRange.x) / (wSpeedRange.y - wSpeedRange.x);\r\n    }\r\n    float norm = length(percent);\r\n\r\n    return norm;\r\n}\r\n\r\nvoid main() {\r\n    vec2 particleIndex = st;\r\n\r\n    vec3 previousPosition = texture2D(previousParticlesPosition, particleIndex).rgb;\r\n    vec3 currentPosition = texture2D(currentParticlesPosition, particleIndex).rgb;\r\n    vec3 nextPosition = texture2D(postProcessingPosition, particleIndex).rgb;\r\n\r\n    float isAnyRandomPointUsed = texture2D(postProcessingPosition, particleIndex).a +\r\n        texture2D(currentParticlesPosition, particleIndex).a +\r\n        texture2D(previousParticlesPosition, particleIndex).a;\r\n\r\n    adjacentPoints projectedCoordinates;\r\n    if (isAnyRandomPointUsed > 0.0) {\r\n        projectedCoordinates.previous = calculateProjectedCoordinate(previousPosition);\r\n        projectedCoordinates.current = projectedCoordinates.previous;\r\n        projectedCoordinates.next = projectedCoordinates.previous;\r\n    } else {\r\n        projectedCoordinates.previous = calculateProjectedCoordinate(previousPosition);\r\n        projectedCoordinates.current = calculateProjectedCoordinate(currentPosition);\r\n        projectedCoordinates.next = calculateProjectedCoordinate(nextPosition);\r\n    }\r\n\r\n    int pointToUse = int(normal.x);\r\n    float offsetSign = normal.y;\r\n    vec4 offset = vec4(0.0);\r\n    // render lines with triangles and miter joint\r\n    // read https://blog.scottlogic.com/2019/11/18/drawing-lines-with-webgl.html for detail\r\n    if (pointToUse == -1) {\r\n        offset = pixelSize * calculateOffsetOnNormalDirection(projectedCoordinates.previous, projectedCoordinates.current, offsetSign);\r\n        gl_Position = projectedCoordinates.previous + offset;\r\n    } else  if (pointToUse == 1) {\r\n        offset = pixelSize * calculateOffsetOnNormalDirection(projectedCoordinates.current, projectedCoordinates.next, offsetSign);\r\n        gl_Position = projectedCoordinates.next + offset;\r\n    }\r\n\r\n    heightNormalization = (currentPosition.z - hRange.x) / (hRange.y - hRange.x);\r\n    \r\n    speedNormalization = texture2D(particlesSpeed, particleIndex).a;\r\n}"

/***/ }),

/***/ 193:
/***/ (function(module) {

module.exports = "uniform sampler2D segmentsColorTexture;\r\nuniform sampler2D segmentsDepthTexture;\r\n\r\nuniform sampler2D currentTrailsColor;\r\nuniform sampler2D trailsDepthTexture;\r\n\r\nuniform float fadeOpacity;\r\n\r\nvarying vec2 textureCoordinate;\r\n\r\nvoid main() {\r\n    vec4 pointsColor = texture2D(segmentsColorTexture, textureCoordinate);\r\n    vec4 trailsColor = texture2D(currentTrailsColor, textureCoordinate);\r\n\r\n    trailsColor = floor(fadeOpacity * 255.0 * trailsColor) / 255.0; // make sure the trailsColor will be strictly decreased\r\n\r\n    float pointsDepth = texture2D(segmentsDepthTexture, textureCoordinate).r;\r\n    float trailsDepth = texture2D(trailsDepthTexture, textureCoordinate).r;\r\n    float globeDepth = czm_unpackDepth(texture2D(czm_globeDepthTexture, textureCoordinate));\r\n\r\n    gl_FragColor = vec4(0.0);\r\n    if (pointsDepth < globeDepth) {\r\n        gl_FragColor = gl_FragColor + pointsColor;\r\n    }\r\n    if (trailsDepth < globeDepth) {\r\n        gl_FragColor = gl_FragColor + trailsColor;\r\n    }\r\n    gl_FragDepthEXT = min(pointsDepth, trailsDepth);\r\n}"

/***/ }),

/***/ 814:
/***/ (function(module) {

module.exports = "uniform sampler2D currentParticlesPosition; // (lon, lat, lev)\r\nuniform sampler2D particlesSpeed; // (u, v, w, norm) Unit converted to degrees of longitude and latitude \r\n\r\nvarying vec2 v_textureCoordinates;\r\n\r\nvoid main() {\r\n    // texture coordinate must be normalized\r\n    vec3 lonLatLev = texture2D(currentParticlesPosition, v_textureCoordinates).rgb;\r\n    vec3 speed = texture2D(particlesSpeed, v_textureCoordinates).rgb;\r\n    vec3 nextParticle = lonLatLev + speed;\r\n    if(length(speed.rgb) > 0.0) {\r\n      gl_FragColor = vec4(nextParticle, 0.0);\r\n    } else {\r\n      gl_FragColor = vec4(0.0);\r\n    }\r\n}"

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	!function() {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = function(exports, definition) {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	!function() {
/******/ 		__webpack_require__.o = function(obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); }
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	!function() {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = function(exports) {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	}();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
!function() {
"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "CalculateSpeedShader": function() { return /* binding */ CalculateSpeedShader; },
/* harmony export */   "PostProcessingPositionShader": function() { return /* binding */ PostProcessingPositionShader; },
/* harmony export */   "UpdatePositionShader": function() { return /* binding */ UpdatePositionShader; },
/* harmony export */   "fullscreenVert": function() { return /* binding */ fullscreenVert; },
/* harmony export */   "screenDrawFrag": function() { return /* binding */ screenDrawFrag; },
/* harmony export */   "segmentDrawFrag": function() { return /* binding */ segmentDrawFrag; },
/* harmony export */   "segmentDrawVert": function() { return /* binding */ segmentDrawVert; },
/* harmony export */   "trailDrawFrag": function() { return /* binding */ trailDrawFrag; }
/* harmony export */ });
var CalculateSpeedShader = __webpack_require__(41);

var UpdatePositionShader = __webpack_require__(814);

var PostProcessingPositionShader = __webpack_require__(391);

var segmentDrawVert = __webpack_require__(473);

var fullscreenVert = __webpack_require__(650);

var screenDrawFrag = __webpack_require__(165);

var segmentDrawFrag = __webpack_require__(918);

var trailDrawFrag = __webpack_require__(193);


}();
WindFlowGLSL = __webpack_exports__;
/******/ })()
;