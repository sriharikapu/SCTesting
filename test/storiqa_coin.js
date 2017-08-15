var StoriqaCoin = artifacts.require("./StoriqaCoin.sol");

contract('StoriqaCoin', function(accounts) {
  const [owner, b, c] = web3.eth.accounts;

  console.log("address is: ", owner);


  it("should set initial value of stq to 0", function() {
    return StoriqaCoin.deployed().then(function(instance) {
      return instance.totalSupply.call();
    }).then(function(balance) {
      assert.equal(balance.valueOf(), 0, "initial value of stq mast be 0");
    });
  });

  it("should be set stq supply to 0", function() {
    res = StoriqaCoin.deployed().then(function(instance) {
      console.log(instance.ico.call());
      return instance.ico.call();
    });
    return res.then(function(ico) {
      
      assert.equal(ico.address, owner, "aco address mast be owner");
    });
  });
})
