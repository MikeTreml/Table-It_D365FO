const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

module.exports = merge(common, {
  mode: 'production',
  devtool: 'source-map',
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: { drop_console: true, drop_debugger: true },
        },
      }),
      new CssMinimizerPlugin(),
    ],
  },
  performance: {
    hints: 'warning',
    maxAssetSize: 512000,
  },
});
