/*jshint esversion: 6 */

'use strict';

const path = require('path');
const {
    merge
} = require('webpack-merge');
const common = require('./webpack.common.js');

// output filename is relative to path.resolve in webpack.common.js
module.exports = merge(common, {
    mode: 'development',
    devServer: {
        contentBase: path.join(__dirname, '../public'),
    },
    output: {
        filename: "js/[name].js",
    },
});
