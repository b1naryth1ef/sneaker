const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");

module.exports = {
  mode: "production",
  entry: "./src/index.tsx",
  devServer: {
    historyApiFallback: true,
  },
  output: {
    filename: "[name].[contenthash].js",
    path: path.resolve(__dirname, "dist"),
    publicPath: "./",
  },
  output: {
    filename: "main.js",
    path: path.resolve(__dirname, "dist"),
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "./src/index.html",
      hash: true,
    }),
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
    }),
  ],
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
      },
      {
        test: /\.css$/i,
        include: path.resolve(__dirname, "src"),
        use: [MiniCssExtractPlugin.loader, "css-loader", "postcss-loader"],
      },
      {
        test: /\.json$/i,
        loader: "json5-loader",
        type: "javascript/auto",
      },
      {
        test: /\.(png|jpg|jpeg|gif|mp3)$/i,
        type: "asset/resource",
      },
    ],
  },
  devServer: {
    contentBase: path.resolve(__dirname, "dist"),
    watchContentBase: true,
  },
};
