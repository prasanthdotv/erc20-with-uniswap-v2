const { ChainId, Token, WETH } = require('@uniswap/sdk');
const { web3, contract } = require('@openzeppelin/test-environment');
const { BN } = require('@openzeppelin/test-helpers');
const ROUTER = contract.fromArtifact('IUniswapV2Router02');
const ERC20 = contract.fromArtifact('IERC20');

const { ROUTER02_ADDRESS_UNISWAP, DECIMALS } = require('../constants');

const getToken = async (contract) => {
  const chainId = ChainId.ROPSTEN;
  const tokenAddress = contract.address;
  const decimals = await contract.decimals();
  const symbol = await contract.symbol();
  const name = await contract.name();
  return new Token(chainId, tokenAddress, decimals, symbol, name);
};

const getWETHInstance = async () => {
  const RouterContract = await ROUTER.at(ROUTER02_ADDRESS_UNISWAP);
  const WETH = await RouterContract.WETH();
  return ERC20.at(WETH);
};

const addLiquidity = async (TokenContract, user) => {
  const RouterContract = await ROUTER.at(ROUTER02_ADDRESS_UNISWAP);
  const tokenAmount = BN(100).mul(BN(10).pow(BN(DECIMALS)));
  const ethAmount = BN(100).mul(BN(10).pow(BN(18)));
  const deadLine = Math.floor(Date.now() / 1000) + 60 * 20;

  await TokenContract.approve(ROUTER02_ADDRESS_UNISWAP, tokenAmount, {
    from: user,
  });

  return await RouterContract.addLiquidityETH(
    TokenContract.address,
    tokenAmount,
    0,
    0,
    user,
    deadLine,
    {
      from: user,
      value: ethAmount,
    }
  );
};

const removeLiquidity = async (TokenContract, pairAddress, user) => {
  const RouterContract = await ROUTER.at(ROUTER02_ADDRESS_UNISWAP);
  const LiquidityTokenContract = await ERC20.at(pairAddress);
  const liquidityTokenAmount = await LiquidityTokenContract.balanceOf(user);

  await LiquidityTokenContract.approve(ROUTER02_ADDRESS_UNISWAP, liquidityTokenAmount, {
    from: user,
  });

  const deadLine = Math.floor(Date.now() / 1000) + 60 * 20;
  return await RouterContract.removeLiquidityETHSupportingFeeOnTransferTokens(
    TokenContract.address,
    liquidityTokenAmount,
    0,
    0,
    user,
    deadLine,
    {
      from: user,
    }
  );
};

const swapETHforToken = async (TokenContract, user) => {
  const RouterContract = await ROUTER.at(ROUTER02_ADDRESS_UNISWAP);
  const token = await getToken(TokenContract);
  const weth = WETH[token.chainId];
  const amountIn = BN(1).mul(BN(10).pow(BN(18))); // 1 WETH
  const path = [weth.address, token.address];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time
  return await RouterContract.swapExactETHForTokens(0, path, user, deadline, {
    from: user,
    value: amountIn,
  });
};

const swapTokenForETH = async (TokenContract, user) => {
  const RouterContract = await ROUTER.at(ROUTER02_ADDRESS_UNISWAP);
  const token = await getToken(TokenContract);
  const weth = WETH[token.chainId];
  const amountIn = BN(1).mul(BN(10).pow(BN(DECIMALS))); // 1 Token

  const path = [token.address, weth.address];
  const to = user; // should be a check summed recipient address
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes from the current Unix time

  await TokenContract.approve(ROUTER02_ADDRESS_UNISWAP, amountIn, {
    from: user,
  });

  return await RouterContract.swapExactTokensForETHSupportingFeeOnTransferTokens(
    amountIn,
    0,
    path,
    to,
    deadline,
    {
      from: user,
    }
  );
};

class Balances {
  constructor(token, eth) {
    this.token = token;
    this.eth = eth;
  }
}

const printBalance = async (contract, users, names) => {
  const promiseArrayToken = [];
  const promiseArrayETH = [];
  users.forEach((user) => {
    promiseArrayToken.push(contract.balanceOf(user));
    promiseArrayETH.push(web3.eth.getBalance(user));
  });
  const tokenBalances = await Promise.all(promiseArrayToken);
  const ETHbalances = await Promise.all(promiseArrayETH);

  const balances = {};

  users.forEach((user, i) => {
    const token =
      BN(tokenBalances[i])
        .divRound(BN(10).pow(BN(DECIMALS - 3)))
        .toString() /
      10 ** 3;
    const eth =
      BN(ETHbalances[i])
        .divRound(BN(10).pow(BN(15)))
        .toString() /
      10 ** 3;
    balances[names[i]] = new Balances(token, eth);
  });

  console.table(balances);
};

module.exports = {
  getToken,
  getWETHInstance,
  addLiquidity,
  removeLiquidity,
  swapETHforToken,
  swapTokenForETH,
  printBalance,
};
