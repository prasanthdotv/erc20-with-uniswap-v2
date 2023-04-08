require('dotenv').config();
const MY_TOKEN = artifacts.require('MyToken');

const { NAME, SYMBOL, DECIMALS, TOTAL_SUPPLY, MARKETING_FUND_WALLET, ADMIN_FUND_WALLET } =
  process.env;
module.exports = async (deployer) => {
  await deployer.deploy(
    MY_TOKEN,
    NAME,
    SYMBOL,
    DECIMALS,
    TOTAL_SUPPLY,
    MARKETING_FUND_WALLET,
    ADMIN_FUND_WALLET
  );
  console.log('Deployed Token Contract address : ', MY_TOKEN.address);
};
