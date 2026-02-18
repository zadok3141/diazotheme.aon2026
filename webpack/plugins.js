const path = require('path');
const _ESLintPlugin = require('eslint-webpack-plugin');
const _AssetsPlugin = require('assets-webpack-plugin');

const ESLintPlugin = new _ESLintPlugin({
    overrideConfigFile: path.resolve(__dirname, 'eslint.config.js'),
    context: path.resolve(__dirname, '../src/diazotheme/aon2026/theme/js'),
    files: '**/*.js',
});

const AssetsPlugin = new _AssetsPlugin({
    filename: 'webpack_assets.json',
    path: path.resolve(__dirname, '../data'),
    prettyPrint: true,
    removeFullPathAutoPrefix: true,
    entrypoints: true,
    // Set entrypoints to false to include file-loader resources in json.
    // Their bundle will have a "" name and I don't know how to change that atm.
});

module.exports = {
    ESLintPlugin,
    AssetsPlugin,
};
