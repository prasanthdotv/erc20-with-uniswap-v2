require('dotenv').config();
const { INFURA_KEY } = process.env;

module.exports = {
  accounts: {
    ether: 10000, // Initial balance of unlocked accounts (in ether)
  },
  contracts: {
    type: 'truffle', // Contract abstraction to use: 'truffle' for @truffle/contract or 'web3' for web3-eth-contract
    artifactsDir: 'build/contracts', // Directory where contract artifacts are stored
  },
  node: {
    // Options passed directly to Ganache client
    fork: `https://ropsten.infura.io/v3/${INFURA_KEY}`, // An url to Ethereum node to use as a source for a fork
  },
};
