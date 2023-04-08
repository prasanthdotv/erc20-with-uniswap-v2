const { accounts, contract } = require('@openzeppelin/test-environment');

const MyToken = contract.fromArtifact('MyToken');
const { NAME, SYMBOL, DECIMALS, TOTAL_SUPPLY } = require('../constants');
const [owner, user1, user2, user3, marketingWallet, adminFundWallet] = accounts;

module.exports = () => {
  return MyToken.new(NAME, SYMBOL, DECIMALS, TOTAL_SUPPLY, marketingWallet, adminFundWallet, {
    from: owner,
  });
};
