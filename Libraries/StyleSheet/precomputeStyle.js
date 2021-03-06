/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @providesModule precomputeStyle
 * @flow
 */
'use strict';

var MatrixMath = require('MatrixMath');
var deepFreezeAndThrowOnMutationInDev = require('deepFreezeAndThrowOnMutationInDev');
var invariant = require('invariant');

/**
 * This method provides a hook where flattened styles may be precomputed or
 * otherwise prepared to become better input data for native code.
 */
function precomputeStyle(style: ?Object): ?Object {
  if (!style || !style.transform) {
    return style;
  }
  invariant(
    !style.transformMatrix,
    'transformMatrix and transform styles cannot be used on the same component'
  );
  var newStyle = _precomputeTransforms({...style});
  deepFreezeAndThrowOnMutationInDev(newStyle);
  return newStyle;
}

/**
 * Generate a transform matrix based on the provided transforms, and use that
 * within the style object instead.
 *
 * This allows us to provide an API that is similar to CSS and to have a
 * universal, singular interface to native code.
 */
function _precomputeTransforms(style: Object): Object {
  var {transform} = style;
  var result = MatrixMath.createIdentityMatrix();

  transform.forEach(transformation => {
    var key = Object.keys(transformation)[0];
    var value = transformation[key];
    if (__DEV__) {
      _validateTransform(key, value, transformation);
    }

    switch (key) {
      case 'matrix':
        MatrixMath.multiplyInto(result, result, value);
        break;
      case 'rotate':
        _multiplyTransform(result, MatrixMath.reuseRotateZCommand, [_convertToRadians(value)]);
        break;
      case 'scale':
        _multiplyTransform(result, MatrixMath.reuseScaleCommand, [value]);
        break;
      case 'scaleX':
        _multiplyTransform(result, MatrixMath.reuseScaleXCommand, [value]);
        break;
      case 'scaleY':
        _multiplyTransform(result, MatrixMath.reuseScaleYCommand, [value]);
        break;
      case 'translate':
        _multiplyTransform(result, MatrixMath.reuseTranslate3dCommand, [value[0], value[1], value[2] || 0]);
        break;
      case 'translateX':
        _multiplyTransform(result, MatrixMath.reuseTranslate2dCommand, [value, 0]);
        break;
      case 'translateY':
        _multiplyTransform(result, MatrixMath.reuseTranslate2dCommand, [0, value]);
        break;
      default:
        throw new Error('Invalid transform name: ' + key);
    }
  });

  return {
    ...style,
    transformMatrix: result,
  };
}

/**
 * Performs a destructive operation on a transform matrix.
 */
function _multiplyTransform(
  result: Array<number>,
  matrixMathFunction: Function,
  args: Array<number>
): void {
  var matrixToApply = MatrixMath.createIdentityMatrix();
  var argsWithIdentity = [matrixToApply].concat(args);
  matrixMathFunction.apply(this, argsWithIdentity);
  MatrixMath.multiplyInto(result, result, matrixToApply);
}

/**
 * Parses a string like '0.5rad' or '60deg' into radians expressed in a float.
 * Note that validation on the string is done in `_validateTransform()`.
 */
function _convertToRadians(value: string): number {
  var floatValue = parseFloat(value, 10);
  return value.indexOf('rad') > -1 ? floatValue : floatValue * Math.PI / 180;
}

function _validateTransform(key, value, transformation) {
  var multivalueTransforms = [
    'matrix',
    'translate',
  ];
  if (multivalueTransforms.indexOf(key) !== -1) {
    invariant(
      Array.isArray(value),
      'Transform with key of %s must have an array as the value: %s',
      key,
      JSON.stringify(transformation)
    );
  }
  switch (key) {
    case 'matrix':
      invariant(
        value.length === 9 || value.length === 16,
        'Matrix transform must have a length of 9 (2d) or 16 (3d). ' +
          'Provided matrix has a length of %s: %s',
        value.length,
        JSON.stringify(transformation)
      );
      break;
    case 'translate':
      break;
    case 'rotate':
      invariant(
        typeof value === 'string',
        'Transform with key of "%s" must be a string: %s',
        key,
        JSON.stringify(transformation)
      );
      invariant(
        value.indexOf('deg') > -1 || value.indexOf('rad') > -1,
        'Rotate transform must be expressed in degrees (deg) or radians ' +
          '(rad): %s',
        JSON.stringify(transformation)
      );
      break;
    default:
      invariant(
        typeof value === 'number',
        'Transform with key of "%s" must be a number: %s',
        key,
        JSON.stringify(transformation)
      );
  }
}

module.exports = precomputeStyle;
