/*jshint esversion: 6 */

const path = require('path');
const loaders = require('./loaders');
const plugins = require('./plugins');
const webpack = require('webpack'); // to access built-in plugins

// entry is relative to project root
// output path in path.resolve is relative to this file
module.exports = {
    entry: ["./src/diazotheme/aon2026/theme/js/aon2026.js"],
    devtool: false,
    module: {
        rules: [
            loaders.JSLoader,
            {
                test: /\.(ttf|woff2)$/i,
                type: 'asset'
            }
        ]
    },
    output: {
        filename: "js/[name].min.js",
        path: path.resolve(__dirname, "../src/diazotheme/aon2026/theme"),
        assetModuleFilename: 'webfonts/[name][ext]'
    },
    plugins: [
        new webpack.ProgressPlugin(),
        plugins.ESLintPlugin,
        plugins.AssetsPlugin,
    ],
};
