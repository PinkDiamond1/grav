const path = require("path");
const yargs = require("yargs");
const env = yargs.argv.env;
const pkg = require("./package.json");
const shouldExportToAMD = yargs.argv.amd;
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

let fileName = pkg.name;

let outputFile, mode;

if (shouldExportToAMD) {
  fileName += ".amd";
}

if (env === "build") {
  mode = "production";
  outputFile = fileName + ".min.js";
} else {
  mode = "development";
  outputFile = fileName + ".js";
}

const config = {
  mode: mode,
  entry: __dirname + "/src/index.js",
  devtool: "source-map",
  output: {
    path: __dirname + "/dist",
    filename: outputFile,
    library: 'Grav',
    libraryTarget: shouldExportToAMD ? "amd" : "umd",
    libraryExport: "default",
    umdNamedDefine: true,
    globalObject: "typeof self !== 'undefined' ? self : this",
  },
  module: {
    rules: [
      {
        test: /(\.jsx|\.js|\.ts|\.tsx)$/,
        use: {
          loader: "babel-loader",
        },
        exclude: /(node_modules|bower_components)/,
      },
    ],
  },
  resolve: {
    modules: [path.resolve("./node_modules"), path.resolve("./src")],
    extensions: [".json", ".js"],
    fallback: {

    }
  },
  plugins: [
    new NodePolyfillPlugin(),
  ]
};

module.exports = config;