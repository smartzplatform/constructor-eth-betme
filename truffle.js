//require('babel-register');
require('babel-register')({
  ignore: /node_modules\/(?!openzeppelin-solidity)/
});
require('babel-polyfill');
module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    development: {
      host: "127.0.0.1",
      port: 9545,
      network_id: "*" // match any network
    },
  },
};
