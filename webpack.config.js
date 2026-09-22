const path = require("path");

module.exports = {
  mode: "production", // Minified
  entry: {
    // What file to take and where to put it
    ["index"]: "./src/index.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js", // Creates file name in 'dist' folder
    library: "[name]",
    libraryTarget: "umd",
    globalObject: "this",
    umdNamedDefine: true,
    clean: true,
  },
  devServer: {
    // Served at http://localhost:3000/index.js for the Webflow staging site
    port: 3000,
    host: "localhost",
    static: {
      directory: path.resolve(__dirname, "dist"),
    },
    devMiddleware: {
      // Serve from memory only: dist/ stays the production build that jsDelivr ships
      writeToDisk: false,
    },
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    allowedHosts: "all",
    hot: false,
    liveReload: false,
    client: false,
  },
};
