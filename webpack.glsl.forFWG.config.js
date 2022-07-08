/*
 * @Author: P.Zhao
 * @Company: HT
 * @Date: 2022-07-07 15:50:19
 * @LastEditors: P.Zhao
 * @LastEditTime: 2022-07-07 15:58:36
 * @Description:
 * @FilePath: \cesium-particle\webpack.glsl.forFWG.config.js
 */
const path = require('path')

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'packages/shader/index.js'),
  output: {
    path: path.join(__dirname, 'src/shader/'),
    library: 'WindFlowGLSL', // 变量名
    filename: 'WindFlowGLSL.js',
    libraryTarget: 'var' //模块输出方式
  },
  optimization: {
    minimize: false // 代码是否压缩
  },
  resolve: {
    extensions: ['.js']
  },
  module: {
    rules: [
      {
        test: /(\.js)$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      },
      {
        test: /\.(frag|vert)$/,
        loader: 'webpack-glsl-loader'
      }
    ]
  }
}
