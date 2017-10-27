require('babel-register');
require('babel-polyfill');

module.exports = {
  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*" // Match any network id
    },

    // geth --testnet --rpc console --port 30304 --rpcport 8547 --wsport 8548 --fast --bootnodes 'enode://20c9ad97c081d63397d7b685a412227a40e23c8bdc6688c6f37e97cfbc22d2b4d1db1510d8f61e6a8866ad7f0e17c02b14182d37ea7c3c8b9c2683aeb6b733a1@52.169.14.227:30303,enode://6ce05930c72abc632c58e2e4324f7c7ea478cec0ed4fa2528982cf34483094e9cbc9216e7aa349691242576d552a2a56aaeae426c5303ded677ce455ba1acd9d@13.84.180.240:30303'
    ropsten: {  // testnet
      host: "localhost",
      port: 8547,
      network_id: 3
    },

    // geth --rinkeby --rpc console --port 30304 --rpcport 8544 --wsport 8548 --syncmode=light --cache=1024 --bootnodes=enode://a24ac7c5484ef4ed0c5eb2d36620ba4e4aa13b8c84684e1b4aab0cebea2ae45cb4d375b77eab56516d34bfbd3c1a833fc51296ff084b770b94fb9028c4d25ccf@52.169.42.101:30303
    rinkeby: {  // testnet
        host: "localhost",
        port: 8544,
        network_id: 4
    },

    // geth --rpcport 8549 --wsport 8550 --rpc console --fast
    mainnet: {
      host: "localhost",
      port: 8549,
      network_id: 1,
      gasPrice: 22000000000
    }
  }
};
