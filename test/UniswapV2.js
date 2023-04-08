const { expect } = require('chai');
const { accounts } = require('@openzeppelin/test-environment');
const {
  BN,
  balance,
  send,
  ether,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { describe } = require('mocha');

const { deploy, Uniswap } = require('./utilities');
const { DECIMALS } = require('./constants');
const [owner, user1, user2, user3, marketingWallet, adminFundWallet] = accounts;

describe('MyToken - Custom functionalities ', () => {
  beforeEach(async () => {
    this.myToken = await deploy();
    this.pairAddress = await this.myToken.pair();
    this.wethToken = await Uniswap.getWETHInstance();

    await this.myToken.transfer(user1, BN(100000).mul(BN(10).pow(BN(DECIMALS))), {
      from: owner,
    });
    await this.myToken.transfer(user2, BN(100000).mul(BN(10).pow(BN(DECIMALS))), {
      from: owner,
    });
    await Uniswap.addLiquidity(this.myToken, owner);
  });

  describe('Liquidity', () => {
    it('Initial Liquidity', async () => {
      const finalWethBalance = await this.wethToken.balanceOf(this.pairAddress);
      const finalTokenBalance = await this.myToken.balanceOf(this.pairAddress);

      expect(finalWethBalance).to.be.bignumber.gt(BN(0));
      expect(finalTokenBalance).to.be.bignumber.gt(BN(0));
    });

    it('Adding Liquidity', async () => {
      const initialWethBalancePair = await this.wethToken.balanceOf(this.pairAddress);
      const initialEthBalanceUser = await balance.current(user1);
      const initialTokenBalancePair = await this.myToken.balanceOf(this.pairAddress);
      const initialTokenBalanceUser = await this.myToken.balanceOf(user1);

      await Uniswap.addLiquidity(this.myToken, user1);

      const finalWethBalancePair = await this.wethToken.balanceOf(this.pairAddress);
      const finalEthBalanceUser = await balance.current(user1);
      const finalTokenBalancePair = await this.myToken.balanceOf(this.pairAddress);
      const finalTokenBalanceUser = await this.myToken.balanceOf(user1);

      expect(finalWethBalancePair).to.be.bignumber.gt(initialWethBalancePair);
      expect(finalTokenBalancePair).to.be.bignumber.gt(initialTokenBalancePair);
      expect(finalEthBalanceUser).to.be.bignumber.lt(initialEthBalanceUser);
      expect(finalTokenBalanceUser).to.be.bignumber.lt(initialTokenBalanceUser);
    });

    it('Removing Liquidity', async () => {
      const initialWethBalancePair = await this.wethToken.balanceOf(this.pairAddress);
      const initialEthBalanceUser = await balance.current(user1);
      const initialTokenBalancePair = await this.myToken.balanceOf(this.pairAddress);
      const initialTokenBalanceUser = await this.myToken.balanceOf(user1);

      await Uniswap.addLiquidity(this.myToken, user1);

      const tempWethBalancePair = await this.wethToken.balanceOf(this.pairAddress);
      const tempEthBalanceUser = await balance.current(user1);
      const tempTokenBalancePair = await this.myToken.balanceOf(this.pairAddress);
      const tempTokenBalanceUser = await this.myToken.balanceOf(user1);

      expect(tempWethBalancePair).to.be.bignumber.gt(initialWethBalancePair);
      expect(tempTokenBalancePair).to.be.bignumber.gt(initialTokenBalancePair);
      expect(tempEthBalanceUser).to.be.bignumber.lt(initialEthBalanceUser);
      expect(tempTokenBalanceUser).to.be.bignumber.lt(initialTokenBalanceUser);

      await Uniswap.removeLiquidity(this.myToken, this.pairAddress, user1);

      const finalWethBalancePair = await this.wethToken.balanceOf(this.pairAddress);
      const finalEthBalanceUser = await balance.current(user1);
      const finalTokenBalancePair = await this.myToken.balanceOf(this.pairAddress);
      const finalTokenBalanceUser = await this.myToken.balanceOf(user1);

      expect(finalWethBalancePair).to.be.bignumber.lt(tempWethBalancePair);
      expect(finalTokenBalancePair).to.be.bignumber.lt(tempTokenBalancePair);
      expect(finalEthBalanceUser).to.be.bignumber.gt(tempEthBalanceUser);
      expect(finalTokenBalanceUser).to.be.bignumber.gt(tempTokenBalanceUser);
    });
  });

  describe('Swapping', () => {
    it('Buy : Swapping ETH for Token', async () => {
      const initialEthBalance = await balance.current(user1);
      const initialTokenBalance = await this.myToken.balanceOf(user1);

      await Uniswap.swapETHforToken(this.myToken, user1);

      const finalEthBalance = await balance.current(user1);
      const finalTokenBalance = await this.myToken.balanceOf(user1);

      expect(finalEthBalance).to.be.bignumber.lt(initialEthBalance);
      expect(finalTokenBalance).to.be.bignumber.gt(initialTokenBalance);
    });

    it('Sell : Swapping TOKEN for ETH', async () => {
      const initialEthBalance = await balance.current(user1);
      const initialTokenBalance = await this.myToken.balanceOf(user1);

      await Uniswap.swapTokenForETH(this.myToken, user1);

      const finalEthBalance = await balance.current(user1);
      const finalTokenBalance = await this.myToken.balanceOf(user1);

      expect(finalEthBalance).to.be.bignumber.gt(initialEthBalance);
      expect(finalTokenBalance).to.be.bignumber.lt(initialTokenBalance);
    });
  });

  describe('Fees Deduction and Splitting', () => {
    it('No fees deducted on common ERC20 token transfer', async () => {
      const isTakeFeeEnabled = await this.myToken.takeFeeEnabled();
      expect(isTakeFeeEnabled).to.be.true;
      const amountIn = BN(10).mul(BN(10).pow(BN(DECIMALS)));
      const initCollectedFee = await this.myToken.collectedFeeTotal();
      const initTokenBalanceOfReceiver = await this.myToken.balanceOf(user3);
      await this.myToken.transfer(user3, amountIn, { from: user1 });
      const finalCollectedFee = await this.myToken.collectedFeeTotal();
      const finalTokenBalanceOfReceiver = await this.myToken.balanceOf(user3);
      const changeInBalance = BN(finalTokenBalanceOfReceiver).sub(BN(initTokenBalanceOfReceiver));
      expect(changeInBalance).to.be.bignumber.eq(amountIn);
      expect(finalCollectedFee).to.be.bignumber.eq(initCollectedFee);
    });
    it('Fees deducted on Uniswap Buy', async () => {
      const isTakeFeeEnabled = await this.myToken.takeFeeEnabled();
      expect(isTakeFeeEnabled).to.be.true;
      const initCollectedFee = await this.myToken.collectedFeeTotal();
      const initialEthBalance = await balance.current(user1);
      const initialTokenBalance = await this.myToken.balanceOf(user1);
      await Uniswap.swapETHforToken(this.myToken, user1);
      const finalEthBalance = await balance.current(user1);
      const finalTokenBalance = await this.myToken.balanceOf(user1);
      const finalCollectedFee = await this.myToken.collectedFeeTotal();
      expect(finalEthBalance).to.be.bignumber.lt(initialEthBalance);
      expect(finalTokenBalance).to.be.bignumber.gt(initialTokenBalance);
      expect(finalCollectedFee).to.be.bignumber.gt(initCollectedFee);
    });
    it('Fees deducted on Uniswap Sell', async () => {
      const isTakeFeeEnabled = await this.myToken.takeFeeEnabled();
      expect(isTakeFeeEnabled).to.be.true;
      const initCollectedFee = await this.myToken.collectedFeeTotal();
      const initialEthBalance = await balance.current(user1);
      const initialTokenBalance = await this.myToken.balanceOf(user1);
      await Uniswap.swapTokenForETH(this.myToken, user1);
      const finalEthBalance = await balance.current(user1);
      const finalTokenBalance = await this.myToken.balanceOf(user1);
      const finalCollectedFee = await this.myToken.collectedFeeTotal();
      expect(finalEthBalance).to.be.bignumber.gt(initialEthBalance);
      expect(finalTokenBalance).to.be.bignumber.lt(initialTokenBalance);
      expect(finalCollectedFee).to.be.bignumber.gt(initCollectedFee);
    });
    it('Transferring a part of deducted fee to Marketing wallet in ETH', async () => {
      const isTakeFeeEnabled = await this.myToken.takeFeeEnabled();
      expect(isTakeFeeEnabled).to.be.true;
      await this.myToken.updateSwapTokensAt(0, {
        from: owner,
      });
      const initCollectedFee = await this.myToken.collectedFeeTotal();
      const initialMarketingWalletBalance = await balance.current(marketingWallet);
      await Uniswap.swapETHforToken(this.myToken, user1);
      await Uniswap.swapTokenForETH(this.myToken, user1);
      const finalCollectedFee = await this.myToken.collectedFeeTotal();
      const finalMarketingWalletBalance = await balance.current(marketingWallet);
      expect(finalCollectedFee).to.be.bignumber.gt(initCollectedFee);
      expect(finalMarketingWalletBalance).to.be.bignumber.gt(initialMarketingWalletBalance);
    });
    it('Transferring a part of deducted fee to Admin Fund wallet in ETH', async () => {
      const isTakeFeeEnabled = await this.myToken.takeFeeEnabled();
      expect(isTakeFeeEnabled).to.be.true;
      await this.myToken.updateSwapTokensAt(0, {
        from: owner,
      });
      const initCollectedFee = await this.myToken.collectedFeeTotal();
      const initialadminFundWalletBalance = await balance.current(adminFundWallet);
      await Uniswap.swapETHforToken(this.myToken, user1);
      await Uniswap.swapTokenForETH(this.myToken, user1);
      const finalCollectedFee = await this.myToken.collectedFeeTotal();
      const finaladminFundWalletBalance = await balance.current(adminFundWallet);
      expect(finalCollectedFee).to.be.bignumber.gt(initCollectedFee);
      expect(finaladminFundWalletBalance).to.be.bignumber.gt(initialadminFundWalletBalance);
    });
    it('No fees deducted when isTakeFeeEnabled is false', async () => {
      await this.myToken.setFeeEnabled(false, { from: owner });
      const isTakeFeeEnabled = await this.myToken.takeFeeEnabled();
      expect(isTakeFeeEnabled).to.be.not.true;
      const initCollectedFee = await this.myToken.collectedFeeTotal();
      const initialEthBalance = await balance.current(user1);
      const initialTokenBalance = await this.myToken.balanceOf(user1);
      await Uniswap.swapTokenForETH(this.myToken, user1);
      const finalEthBalance = await balance.current(user1);
      const finalTokenBalance = await this.myToken.balanceOf(user1);
      const finalCollectedFee = await this.myToken.collectedFeeTotal();
      expect(finalEthBalance).to.be.bignumber.gt(initialEthBalance);
      expect(finalTokenBalance).to.be.bignumber.lt(initialTokenBalance);
      expect(finalCollectedFee).to.be.bignumber.eq(initCollectedFee);
    });
    it('No fees deducted from fee excluded users on Uniswap Buy/Sell', async () => {
      const isTakeFeeEnabled = await this.myToken.takeFeeEnabled();
      expect(isTakeFeeEnabled).to.be.true;
      await this.myToken.setExcludedFromFee(user1, true, {
        from: owner,
      });
      const isExcludedFromFee = await this.myToken.isExcludedFromFee(user1);
      expect(isExcludedFromFee).to.be.true;
      const initCollectedFee = await this.myToken.collectedFeeTotal();
      const initialEthBalance = await balance.current(user1);
      const initialTokenBalance = await this.myToken.balanceOf(user1);
      await Uniswap.swapETHforToken(this.myToken, user1);
      const finalEthBalance = await balance.current(user1);
      const finalTokenBalance = await this.myToken.balanceOf(user1);
      const finalCollectedFee = await this.myToken.collectedFeeTotal();
      expect(finalEthBalance).to.be.bignumber.lt(initialEthBalance);
      expect(finalTokenBalance).to.be.bignumber.gt(initialTokenBalance);
      expect(finalCollectedFee).to.be.bignumber.eq(initCollectedFee);
    });
    it('Event emitted when user excluded from fee', async () => {
      const receipt = await this.myToken.setExcludedFromFee(user1, true, {
        from: owner,
      });
      expectEvent(receipt, 'ExcludeFromFees', {
        account: user1,
        isExcluded: true,
      });
    });
    it('Transferring deducted fee only it reaches specific amount', async () => {
      const isTakeFeeEnabled = await this.myToken.takeFeeEnabled();
      expect(isTakeFeeEnabled).to.be.true;

      await this.myToken.updateSwapTokensAt(BN(1).mul(BN(10).pow(BN(DECIMALS - 2))), {
        from: owner,
      });

      const swapTokensAt = await this.myToken.swapTokensAtAmount();

      const initCollectedFee = await this.myToken.collectedFeeTotal();
      const initialMarketingWalletBalance = await balance.current(marketingWallet);

      expect(initCollectedFee).to.be.bignumber.lt(swapTokensAt);

      await Uniswap.swapETHforToken(this.myToken, user1);
      const tempCollectedFee = await this.myToken.collectedFeeTotal();
      const tempMarketingWalletBalance = await balance.current(marketingWallet);

      expect(tempCollectedFee).to.be.bignumber.gt(initCollectedFee);
      expect(tempMarketingWalletBalance).to.be.bignumber.eq(initialMarketingWalletBalance);
      expect(tempCollectedFee).to.be.bignumber.gte(swapTokensAt);

      await Uniswap.swapTokenForETH(this.myToken, user1);
      const finalCollectedFee = await this.myToken.collectedFeeTotal();
      const finalMarketingWalletBalance = await balance.current(marketingWallet);

      expect(finalCollectedFee).to.be.bignumber.gt(tempCollectedFee);
      expect(finalMarketingWalletBalance).to.be.bignumber.gt(tempMarketingWalletBalance);
    });
    it('Transferring deducted fee only if swap is enabled', async () => {
      const isTakeFeeEnabled = await this.myToken.takeFeeEnabled();
      expect(isTakeFeeEnabled).to.be.true;

      await this.myToken.updateSwapTokensAt(BN(0), {
        from: owner,
      });

      const swapTokensAt = await this.myToken.swapTokensAtAmount();
      const initCollectedFee = await this.myToken.collectedFeeTotal();
      const initialMarketingWalletBalance = await balance.current(marketingWallet);

      await this.myToken.setSwapEnabled(false, {
        from: owner,
      });
      const isSwapEnabled = await this.myToken.swapEnabled();
      expect(isSwapEnabled).to.be.not.true;

      await Uniswap.swapETHforToken(this.myToken, user1);

      expect(initCollectedFee).to.be.bignumber.gte(swapTokensAt);

      await Uniswap.swapTokenForETH(this.myToken, user1);
      const finalCollectedFee = await this.myToken.collectedFeeTotal();
      const finalMarketingWalletBalance = await balance.current(marketingWallet);

      expect(finalCollectedFee).to.be.bignumber.gt(initCollectedFee);
      expect(finalMarketingWalletBalance).to.be.bignumber.eq(initialMarketingWalletBalance);
    });
  });

  describe('Update functions', () => {
    it('Only owner can update these values', async () => {
      const newValue = BN(10).mul(BN(10).pow(BN(DECIMALS)));
      await expectRevert(
        this.myToken.updateTransactionMax(newValue, { from: user1 }),
        'Ownable: caller is not the owner'
      );
    });

    it('Enable or disable trading', async () => {
      const tradingIsEnabled = await this.myToken.tradingIsEnabled();
      expect(tradingIsEnabled).is.true;

      await this.myToken.updateTradingIsEnabled(false, { from: owner });
      const updatedValue = await this.myToken.tradingIsEnabled();

      expect(updatedValue).to.be.not.true;
    });

    it('Update maximum transaction limit', async () => {
      const newValue = BN(10).mul(BN(10).pow(BN(DECIMALS)));
      await this.myToken.updateTransactionMax(newValue, { from: owner });
      const updatedValue = await this.myToken.maxTxAmount();

      expect(updatedValue).to.be.bignumber.equal(newValue);
    });

    it('Update maximum wallet balance limit', async () => {
      const newValue = BN(10).mul(BN(10).pow(BN(DECIMALS)));
      await this.myToken.updateWalletMax(newValue, { from: owner });
      const updatedValue = await this.myToken.maxWalletBalance();

      expect(updatedValue).to.be.bignumber.equal(newValue);
    });

    it('Update fee transfer limit', async () => {
      const newValue = BN(10).mul(BN(10).pow(BN(DECIMALS)));
      await this.myToken.updateSwapTokensAt(newValue, { from: owner });
      const updatedValue = await this.myToken.swapTokensAtAmount();

      expect(updatedValue).to.be.bignumber.equal(newValue);
    });

    it('Update fees', async () => {
      const newMarketingFee = BN(500);
      const newAdminFundFee = BN(1500);
      const newLiquidityFee = BN(1000);
      await this.myToken.updateFees(newMarketingFee, newAdminFundFee, newLiquidityFee, {
        from: owner,
      });

      const updatedMarketingFee = await this.myToken.marketingFee();
      const updatedAdminFundFee = await this.myToken.adminFee();
      const updatedLiquidityFee = await this.myToken.lpFee();

      expect(updatedMarketingFee).to.be.bignumber.equal(newMarketingFee);
      expect(updatedAdminFundFee).to.be.bignumber.equal(newAdminFundFee);
      expect(updatedLiquidityFee).to.be.bignumber.equal(newLiquidityFee);
    });

    it('Total fees can not exceed 100%', async () => {
      const newMarketingFee = BN(4000);
      const newAdminFundFee = BN(4000);
      const newLiquidityFee = BN(4000);
      await expectRevert(
        this.myToken.updateFees(newMarketingFee, newAdminFundFee, newLiquidityFee, {
          from: owner,
        }),
        'MyToken: Total Fees cannot be greater than 10000 (100%)(1500 = 1.5%)'
      );
    });

    it('Update wallet addresses', async () => {
      await this.myToken.updateMarketingWallet(user1, {
        from: owner,
      });

      await this.myToken.updateadminFundWallet(user2, {
        from: owner,
      });

      const updatedMarketingWallet = await this.myToken.marketingWallet();
      const updatedadminFundWallet = await this.myToken.adminFundWallet();

      expect(updatedMarketingWallet).to.be.equal(user1);
      expect(updatedadminFundWallet).to.be.equal(user2);
    });

    it('Event emitted when wallet addresses are updated', async () => {
      const receipt1 = await this.myToken.updateMarketingWallet(user1, {
        from: owner,
      });
      expectEvent(receipt1, 'MarketingWalletUpdated', {
        newMarketingWallet: user1,
        oldMarketingWallet: marketingWallet,
      });

      const receipt2 = await this.myToken.updateadminFundWallet(user2, {
        from: owner,
      });
      expectEvent(receipt2, 'adminFundWalletUpdated', {
        newadminFundWallet: user2,
        oldadminFundWallet: adminFundWallet,
      });
    });

    it('Update portions of swap', async () => {
      const newMarketingPortion = BN(3000);
      const newAdminFundPortion = BN(5000);
      const newLiquidityPortion = BN(2000);
      await this.myToken.updatePortionsOfSwap(
        newMarketingPortion,
        newAdminFundPortion,
        newLiquidityPortion,
        {
          from: owner,
        }
      );

      const updatedMarketingPortion = await this.myToken.marketingPortionOfSwap();
      const updatedAdminFundPortion = await this.myToken.adminPortionOfSwap();
      const updatedLiquidityPortion = await this.myToken.lpPortionOfSwap();

      expect(updatedMarketingPortion).to.be.bignumber.equal(newMarketingPortion);
      expect(updatedAdminFundPortion).to.be.bignumber.equal(newAdminFundPortion);
      expect(updatedLiquidityPortion).to.be.bignumber.equal(newLiquidityPortion);
    });

    it('Total portions must be 100%', async () => {
      const newMarketingFee = BN(4000);
      const newAdminFundFee = BN(4000);
      const newLiquidityFee = BN(4000);
      await expectRevert(
        this.myToken.updatePortionsOfSwap(newMarketingFee, newAdminFundFee, newLiquidityFee, {
          from: owner,
        }),
        'MyToken: Total must be equal to 10000 (100%)(1500 = 1.5%)'
      );
    });
  });

  describe('Withdraw', () => {
    it('Withdraw leftover tokens in terms of ETH', async () => {
      const contractAddress = this.myToken.address;
      const tokenAmount = BN(100);
      await this.myToken.transfer(contractAddress, tokenAmount, {
        from: owner,
      });

      const contractBalance = await this.myToken.balanceOf(contractAddress);

      expect(contractBalance).is.to.bignumber.eq(tokenAmount);

      const user1EthTracker = await balance.tracker(user1, 'wei');

      await this.myToken.swapTokensAndWithdrawInETH(user1, tokenAmount, {
        from: owner,
      });

      const delta = await user1EthTracker.delta();

      expect(delta).is.to.be.bignumber.gt(BN(0));
    });

    it('Withdraw leftover ETH', async () => {
      const contractAddress = this.myToken.address;
      await send.ether(owner, contractAddress, ether('10'));

      const contractBalance = await balance.current(contractAddress);

      expect(contractBalance).is.to.bignumber.eq(ether('10'));

      const user1EthTracker = await balance.tracker(user1, 'wei');

      await this.myToken.withdrawETH(user1, {
        from: owner,
      });

      const delta = await user1EthTracker.delta();

      expect(delta).is.to.be.bignumber.gt(BN(0));
    });
  });
});
