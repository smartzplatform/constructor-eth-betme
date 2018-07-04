const contract = artifacts.require("BetMe");

module.exports = function(deployer) {
  // deployment steps
  deployer.deploy(contract);
};

