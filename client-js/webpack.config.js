const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    // Punto de entrada único: toda la SPA se construye desde aquí
    entry: './src/index.js',

    // Bundle unificado en dist/ con hash de contenido para cache-busting
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction
        ? 'js/[name].[contenthash:8].js'
        : 'js/[name].bundle.js',
      clean: true
    },

    module: {
      rules: [
        {
          // style-loader inyecta el CSS en el DOM, css-loader resuelve los @import/url()
          test: /\.css$/i,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|jpe?g|gif|svg|webp)$/i,
          type: 'asset/resource',
          generator: { filename: 'assets/[name].[hash:8][ext]' }
        }
      ]
    },

    plugins: [
      // Inyecta automáticamente el <script> del bundle en el HTML generado
      new HtmlWebpackPlugin({
        template: './src/index.html',
        filename: 'index.html',
        title: 'Icesi Live Arena — Reserva de Boletas',
        inject: 'body'
      })
    ],

    resolve: {
      extensions: ['.js'],
      // Alias para evitar rutas relativas frágiles del tipo ../../../
      alias: {
        '@': path.resolve(__dirname, 'src')
      },
      // La librería 'ice' referencia módulos nativos de Node (net, fs) dentro de
      // guardas de entorno. En el navegador esas ramas nunca se ejecutan, pero
      // Webpack 5 intenta resolverlas al compilar. Se descartan explícitamente.
      fallback: {
        net: false,
        fs: false
      }
    },

    // Servidor de desarrollo exigido por el enunciado: puerto 3000
    devServer: {
      static: { directory: path.resolve(__dirname, 'dist') },
      port: 3000,
      open: true,
      hot: true,
      client: { overlay: true }
    },

    // El código que genera slice2js usa un require() dinámico que Webpack no
    // puede analizar estáticamente. La advertencia es inofensiva en el
    // navegador, donde Ice se resuelve desde window, y se silencia solo para
    // esa carpeta.
    ignoreWarnings: [
      { module: /src[\\/]generated[\\/]/ }
    ],

    devtool: isProduction ? 'source-map' : 'eval-source-map',
    performance: { hints: false }
  };
};