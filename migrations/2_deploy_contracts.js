var StoriqaCoin = artifacts.require("./StoriqaCoin.sol");

module.exports = function(deployer) {
  deployer.deploy(StoriqaCoin);
}

// var ConvertLib = artifacts.require("./ConvertLib.sol");
// var MetaCoin = artifacts.require("./MetaCoin.sol");
//
// module.exports = function(deployer) {
//   deployer.deploy(ConvertLib);
//   deployer.link(ConvertLib, MetaCoin);
//   deployer.deploy(MetaCoin);
// };
