/*jshint esversion: 6 */

'use strict';

const plugins = require('./plugins');

const {
    merge
} = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'production',
});
