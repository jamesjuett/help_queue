const path = require('path');

module.exports = {
  entry: './src/js/main.ts',
  devtool: "inline-source-map",
  output: {
    path: path.join(__dirname, '/public/queue/js/'),
    filename: 'bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
};