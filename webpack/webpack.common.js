const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const srcPath = path.resolve(__dirname, '../src');
const distPath = path.resolve(__dirname, '../dist');
const publicPath = path.resolve(__dirname, '../public');

module.exports = {
  entry: {
    'background/service-worker': path.join(srcPath, 'background/service-worker.ts'),
    popup: path.join(srcPath, 'popup/popup.tsx'),
    'pages/tables': path.join(srcPath, 'pages/tables/tables.tsx'),
    'pages/entities': path.join(srcPath, 'pages/entities/entities.tsx'),
    'pages/odata-builder': path.join(srcPath, 'pages/odata-builder/odata-builder.tsx'),
    'pages/entity-data': path.join(srcPath, 'pages/entity-data/entity-data.tsx'),
    'pages/entity-fields': path.join(srcPath, 'pages/entity-fields/entity-fields.tsx'),
    'pages/relations': path.join(srcPath, 'pages/relations/relations.tsx'),
  },

  output: {
    path: distPath,
    filename: '[name].js',
    clean: true,
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@': srcPath,
      '@shared': path.join(srcPath, 'shared'),
      '@popup': path.join(srcPath, 'popup'),
      '@pages': path.join(srcPath, 'pages'),
    },
  },

  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'babel-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { importLoaders: 1 } },
          'postcss-loader',
        ],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/images/[name][ext]',
        },
      },
    ],
  },

  plugins: [
    new MiniCssExtractPlugin({ filename: '[name].css' }),

    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'popup/popup.html'),
      filename: 'popup.html',
      chunks: ['popup'],
    }),

    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'pages/tables/tables.html'),
      filename: 'Tables.html',
      chunks: ['pages/tables'],
    }),

    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'pages/entities/entities.html'),
      filename: 'Entities.html',
      chunks: ['pages/entities'],
    }),

    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'pages/odata-builder/odata-builder.html'),
      filename: 'ODataBuilder.html',
      chunks: ['pages/odata-builder'],
    }),

    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'pages/entity-data/entity-data.html'),
      filename: 'EntityData.html',
      chunks: ['pages/entity-data'],
    }),

    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'pages/entity-fields/entity-fields.html'),
      filename: 'EntityFields.html',
      chunks: ['pages/entity-fields'],
    }),

    new HtmlWebpackPlugin({
      template: path.join(srcPath, 'pages/relations/relations.html'),
      filename: 'Relations.html',
      chunks: ['pages/relations'],
    }),

    new CopyWebpackPlugin({
      patterns: [
        { from: path.join(publicPath, 'manifest.json'), to: distPath },
        { from: 'icon*.png', context: publicPath, to: distPath },
        {
          from: path.join(srcPath, 'assets'),
          to: path.join(distPath, 'assets'),
          noErrorOnMissing: true,
        },
      ],
    }),
  ],

  optimization: {
    splitChunks: {
      chunks(chunk) {
        return chunk.name !== 'background/service-worker';
      },
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
        },
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          priority: 20,
        },
      },
    },
  },
};
