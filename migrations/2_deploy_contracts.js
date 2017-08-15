var StoriqaCoin = artifacts.require("./StoriqaCoin.sol");
var ICO = artifacts.require("./ICO.sol");
var EmissionCoin = artifacts.require("./Emission.sol");

module.exports = function(deployer) {
  res_stq = deployer.deploy(StoriqaCoin);
  res_stq.then(StoriqaCoin.deployed).then(function(stq) {
    res_ico = deployer.deploy(ICO, stq.address);

    res_ico.then(ICO.deployed).then(function(ico) {
      res_em = deployer.deploy(EmissionCoin, stq.address, ico.address);
    });
  })
}
