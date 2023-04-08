const { expect } = require('chai');
const { accounts } = require('@openzeppelin/test-environment');
const { BN, constants, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { describe } = require('mocha');

const { deploy } = require('./utilities');
const { NAME, SYMBOL, TOTAL_SUPPLY, DECIMALS } = require('./constants');
const [owner, user1, user2, user3, marketingWallet, adminFundWallet] = accounts;

describe('MyToken - Testing common ERC20 functionalities', () => {
  const TOTAL_SUPPLY_BN = new BN(TOTAL_SUPPLY);
  const DECIMAL_BN = new BN(DECIMALS);
  const TOTAL_SUPPLY_BN_WEI = TOTAL_SUPPLY_BN.mul(BN(10).pow(DECIMAL_BN));

  beforeEach(async () => {
    this.myToken = await deploy();
  });

  describe.only('Deployment', () => {
    it.only('Deployer is owner', async () => {
      expect(await this.myToken.owner()).to.equal(owner);
    });
  });

  describe('Metadata', () => {
    it('token metadata is correct', async () => {
      expect(await this.myToken.name()).to.equal(NAME);
      expect(await this.myToken.symbol()).to.equal(SYMBOL);
      expect((await this.myToken.decimals()).eq(DECIMAL_BN)).is.true;
      expect((await this.myToken.totalSupply()).eq(TOTAL_SUPPLY_BN_WEI)).is.true;
      expect(await this.myToken.marketingWallet()).to.equal(marketingWallet);
      expect(await this.myToken.adminFundWallet()).to.equal(adminFundWallet);
    });
  });

  describe('Token Transfer', () => {
    it('Coins are minted and transferred to the owner', async () => {
      expect((await this.myToken.balanceOf(owner)).div(BN(10).pow(DECIMAL_BN)).eq(TOTAL_SUPPLY_BN))
        .is.true;
    });

    it('Users can transfer tokens to other users', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      //owner to user1
      await this.myToken.transfer(user1, amountToSendBN, {
        from: owner,
      });
      expect((await this.myToken.balanceOf(user1)).eq(amountToSendBN)).is.true;
      //user1 to user2
      await this.myToken.transfer(user2, amountToSendBN, {
        from: user1,
      });
      expect((await this.myToken.balanceOf(user2)).eq(amountToSendBN)).is.true;
    });

    it('Event emitted when tokens are transferred', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      const receipt = await this.myToken.transfer(user1, amountToSendBN, {
        from: owner,
      });
      expectEvent(receipt, 'Transfer', {
        from: owner,
        to: user1,
        value: amountToSendBN,
      });
    });

    it('Reverts if user tries to transfer tokens without enough balance', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      await expectRevert(
        this.myToken.transfer(user2, amountToSendBN, {
          from: user1,
        }),
        'ERC20: Transfer amount exceeds balance -- Reason given: ERC20: Transfer amount exceeds balance.'
      );
    });

    it('Reverts if user tries to transfer more than maximum transaction amount', async () => {
      const maxTxnAmnt = await this.myToken.maxTxAmount();
      const amountToSendBN = BN(maxTxnAmnt).add(BN(1));
      await expectRevert(
        this.myToken.transfer(user2, amountToSendBN, {
          from: owner,
        }),
        'MyToken: Transfer amount exceeds the Max Transaction Amount. -- Reason given: MyToken: Transfer amount exceeds the Max Transaction Amount.'
      );
    });

    it('Reverts if user tries to transfer 0 tokens', async () => {
      const amountToSendBN = BN(0).mul(BN(10).pow(DECIMAL_BN));
      await expectRevert(
        this.myToken.transfer(user2, amountToSendBN, {
          from: user1,
        }),
        'ERC20: Transfer amount must be greater than zero -- Reason given: ERC20: Transfer amount must be greater than zero.'
      );
    });

    it('Reverts if user tries to transfer tokens to zero address', async () => {
      const amountToSendBN = BN(10).mul(BN(10).pow(DECIMAL_BN));
      await expectRevert(
        this.myToken.transfer(constants.ZERO_ADDRESS, amountToSendBN, {
          from: user1,
        }),
        'ERC20: Transfer to the zero address -- Reason given: ERC20: Transfer to the zero address.'
      );
    });

    it('Revert when wallet balance exceeds maximum balance limit', async () => {
      const maxWalletBalance = await this.myToken.maxWalletBalance();
      const maxTxnLimit = BN(maxWalletBalance).add(BN(1));
      await this.myToken.updateTransactionMax(maxTxnLimit, { from: owner });
      await this.myToken.transfer(user1, maxTxnLimit, {
        from: owner,
      });

      await expectRevert(
        this.myToken.transfer(user2, maxTxnLimit, {
          from: user1,
        }),
        'MyToken: New balance would exceed the maxWalletBalance'
      );
    });

    it('Revert all transactions when trading is disabled', async () => {
      await this.myToken.updateTradingIsEnabled(false, { from: owner });
      await expectRevert(
        this.myToken.transfer(user2, BN(1), {
          from: owner,
        }),
        'MyToken: This account cannot send tokens until trading is enabled'
      );
    });
  });

  describe('Allowance', () => {
    it('Approve transfer of available tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      const balanceOfOwner = await this.myToken.balanceOf(owner);
      const balanceOfUser1 = await this.myToken.balanceOf(user1);
      const balanceOfUser2 = await this.myToken.balanceOf(user2);
      //approving allowance
      await this.myToken.approve(user1, amountToSendBN, {
        from: owner,
      });
      //checking allowance
      expect((await this.myToken.allowance(owner, user1)).eq(amountToSendBN));
      //verifying transaction of approved tokens
      await this.myToken.transferFrom(owner, user2, amountToSendBN, {
        from: user1,
      });
      expect((await this.myToken.balanceOf(owner)).eq(balanceOfOwner.sub(amountToSendBN)));
      expect((await this.myToken.balanceOf(user1)).eq(balanceOfUser1));
      expect((await this.myToken.balanceOf(user2)).eq(balanceOfUser2.add(amountToSendBN)));
    });

    it('Event emitted someone approves transfer of available tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      const receipt = await this.myToken.approve(user1, amountToSendBN, {
        from: owner,
      });
      expectEvent(receipt, 'Approval', {
        owner,
        spender: user1,
        value: amountToSendBN,
      });
    });

    it('Increase allowance', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      const increasedAmountBN = BN(500).mul(BN(10).pow(DECIMAL_BN));
      await this.myToken.approve(user1, amountToSendBN, {
        from: owner,
      });
      expect((await this.myToken.allowance(owner, user1)).eq(amountToSendBN));
      await this.myToken.increaseAllowance(user1, increasedAmountBN, {
        from: owner,
      });
      expect(
        (await this.myToken.allowance(owner, user1)).eq(amountToSendBN.add(increasedAmountBN))
      );
    });

    it('Decrease allowance', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      const increasedAmountBN = BN(500).mul(BN(10).pow(DECIMAL_BN));
      await this.myToken.approve(user1, amountToSendBN, {
        from: owner,
      });
      expect((await this.myToken.allowance(owner, user1)).eq(amountToSendBN));
      await this.myToken.increaseAllowance(user1, increasedAmountBN, {
        from: owner,
      });
      expect(
        (await this.myToken.allowance(owner, user1)).eq(amountToSendBN.sub(increasedAmountBN))
      );
    });

    it('Revert when trying to approve transfer of unavailable tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      //approving allowance
      await this.myToken.approve(user2, amountToSendBN, {
        from: user1,
      });
      //checking allowance
      expect((await this.myToken.allowance(user1, user2)).eq(amountToSendBN));
      //verifying transaction of approved tokens
      await expectRevert(
        this.myToken.transferFrom(user1, user3, amountToSendBN, {
          from: user2,
        }),
        'ERC20: Transfer amount exceeds balance -- Reason given: ERC20: Transfer amount exceeds balance.'
      );
    });

    it('Revert when trying to transfer more than allowed tokens by third-party', async () => {
      const amountToSendBN = BN(1000).mul(BN(10).pow(DECIMAL_BN));
      //approving allowance
      await this.myToken.approve(user1, amountToSendBN, {
        from: owner,
      });
      //checking allowance
      expect((await this.myToken.allowance(owner, user1)).eq(amountToSendBN));
      //verifying transaction of approved tokens
      await expectRevert(
        this.myToken.transferFrom(owner, user2, amountToSendBN.add(BN(1000)), {
          from: user1,
        }),
        'ERC20: Transfer amount exceeds allowance -- Reason given: ERC20: Transfer amount exceeds allowance.'
      );
    });
  });

  describe('Ownership', () => {
    it('Transferring ownership', async () => {
      await this.myToken.transferOwnership(user1, { from: owner });
      expect(await this.myToken.owner()).to.equal(user1);
    });

    it('Event emitted on transferring ownership', async () => {
      const receipt = await this.myToken.transferOwnership(user1, {
        from: owner,
      });
      expectEvent(receipt, 'OwnershipTransferred', {
        previousOwner: owner,
        newOwner: user1,
      });
    });

    it('Revert when some user other than owner tries to transfer ownership', async () => {
      await expectRevert(
        this.myToken.transferOwnership(user1, { from: user2 }),
        'Ownable: caller is not the owner -- Reason given: Ownable: caller is not the owner.'
      );
    });

    it('Renounce ownership', async () => {
      await this.myToken.renounceOwnership({ from: owner });
      expect(await this.myToken.owner()).to.not.equal(owner);
    });

    it('Revert when some user other than owner tries to renounce ownership', async () => {
      await expectRevert(
        this.myToken.renounceOwnership({ from: user2 }),
        'Ownable: caller is not the owner -- Reason given: Ownable: caller is not the owner.'
      );
    });
  });
});
