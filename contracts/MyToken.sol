/**
 * SPDX-License-Identifier: MIT
 */

pragma solidity 0.8.15;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol';
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol';

/**
 * @title ERC20 Token
 * Custom ERC20 token with fee on Uniswap Buy and Sell
 */
contract MyToken is IERC20Metadata, Ownable, ReentrancyGuard {
  ///To send fee from transactions
  address public marketingWallet;
  address public adminFundWallet;

  string private _name;
  string private _symbol;
  uint8 private _decimals;
  uint256 private _totalSupply;

  uint256 private constant MAX = ~uint256(0);

  uint256 public collectedFeeTotal;
  uint256 public maxTxAmount; /// 0.1% of the total supply
  uint256 public maxWalletBalance; /// 2% of the total supply

  bool public takeFeeEnabled = true;
  bool public tradingIsEnabled = true;
  bool private swapping = false;
  bool public swapEnabled = true;

  ///Collected fee will transfered to corresponding wallets only if it reaches this amount
  uint256 public swapTokensAtAmount; //0.1 token

  uint256 private constant FEES_DIVISOR = 10 ** 4;

  uint256 public marketingFee = 50; ///0.5%
  uint256 public adminFee = 150; ///1.5%
  uint256 public lpFee = 100; ///1%
  uint256 private totalFee;

  uint256 public marketingPortionOfSwap = 1667; /// 16.67%
  uint256 public adminPortionOfSwap = 5000; /// 50%
  uint256 public lpPortionOfSwap = 3333; /// 33.33%

  IUniswapV2Router02 public router;
  address public pair;

  mapping(address => uint256) internal _balances;
  mapping(address => mapping(address => uint256)) internal _allowances;
  mapping(address => bool) internal _isExcludedFromFee;

  event UpdateUniswapRouter(address indexed newAddress, address indexed oldAddress);
  event ExcludeFromFees(address indexed account, bool isExcluded);
  event MarketingWalletUpdated(
    address indexed newMarketingWallet,
    address indexed oldMarketingWallet
  );
  event adminFundWalletUpdated(
    address indexed newadminFundWallet,
    address indexed oldadminFundWallet
  );
  event LiquidityAdded(uint256 tokenAmountSent, uint256 ethAmountSent, uint256 liquidity);
  event SwapTokensForETH(uint256 amountIn, address[] path);

  modifier zeroAddressCheck(address _theAddress) {
    require(_theAddress != address(0), 'ERC20:Address cannot be the zero address');
    _;
  }

  /**
   * @dev Constructor
   * @param name_ ERC20 Token name
   * @param symbol_ ERC20 Token symbol
   * @param marketingWallet_ Wallet to collect marketing fee
   * @param adminFundWallet_ Wallet to collect admin fund
   */
  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 totalSupply_,
    address marketingWallet_,
    address adminFundWallet_
  ) {
    ///Initial setup
    _name = name_;
    _symbol = symbol_;
    _decimals = decimals_;
    _totalSupply = totalSupply_ * (10 ** uint256(decimals_));
    marketingWallet = marketingWallet_;
    adminFundWallet = adminFundWallet_;

    maxTxAmount = _totalSupply / 1000; /// 0.1% of the total supply
    maxWalletBalance = _totalSupply / 50; /// 2% of the total supply
    swapTokensAtAmount = 1 * (10 ** (_decimals - 1)); //0.1 token

    ///Initial allocation of tokens to owner
    _balances[owner()] = _totalSupply;

    ///Creating TOKEN-WETH uniswap pair
    address UNISWAP_V2_ROUTER02 = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    router = IUniswapV2Router02(UNISWAP_V2_ROUTER02);
    pair = IUniswapV2Factory(router.factory()).createPair(address(this), router.WETH());

    /// Set fees
    totalFee = marketingFee + adminFee + lpFee;

    /// Exclude owner and this contract from fee
    _isExcludedFromFee[owner()] = true;
    _isExcludedFromFee[address(this)] = true;

    /// Giving approvals for smooth uniswap operations
    _approve(owner(), address(router), ~uint256(0));
    _approve(address(this), owner(), ~uint256(0));

    emit Transfer(address(0), owner(), _totalSupply);
  }

  /**
   * @dev Function to receive ETH when sending fee and adding liquidity
   */
  receive() external payable {}

  /**
   * @dev Function to get name
   * @return name ERC20 Token name
   */
  function name() external view override returns (string memory) {
    return _name;
  }

  /**
   * @dev Function to get symbol
   * @return symbol ERC20 Token symbol
   */
  function symbol() external view override returns (string memory) {
    return _symbol;
  }

  /**
   * @dev Function to get decimals
   * @return decimals ERC20 Token decimals
   */
  function decimals() external view override returns (uint8) {
    return _decimals;
  }

  /**
   * @dev Function to get totalSupply
   * @return totalSupply ERC20 Token totalSupply
   */
  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  /**
   * @dev Function to get token balance
   * @param account Address
   * @return balance Current balance
   */
  function balanceOf(address account) public view override returns (uint256) {
    return _balances[account];
  }

  /**
   * @dev Function to get transfer tokens
   * @param recipient Address
   * @param amount Amount to transfer
   * @return bool Transaction status
   */
  function transfer(address recipient, uint256 amount) external override returns (bool) {
    _transfer(_msgSender(), recipient, amount);
    return true;
  }

  /**
   * @dev Function to check token allowance
   * @param owner Address
   * @param spender Address
   * @return allowance Current token allowance
   */
  function allowance(address owner, address spender) external view override returns (uint256) {
    return _allowances[owner][spender];
  }

  /**
   * @dev Function to give allowance
   * @param spender Address
   * @param amount Amount
   * @return bool Status
   */
  function approve(address spender, uint256 amount) external override returns (bool) {
    _approve(_msgSender(), spender, amount);
    return true;
  }

  /**
   * @dev Function to transfer token from allowance
   * @param sender Address
   * @param recipient Address
   * @param amount Amount
   * @return bool Status
   */
  function transferFrom(
    address sender,
    address recipient,
    uint256 amount
  ) external override returns (bool) {
    _transfer(sender, recipient, amount);
    require(
      _allowances[sender][_msgSender()] >= amount,
      'ERC20: Transfer amount exceeds allowance'
    );
    _approve(sender, _msgSender(), _allowances[sender][_msgSender()] - amount);
    return true;
  }

  /**
   * @dev Function to increase allowance
   * @param spender Address
   * @param addedValue Amount to increase
   * @return bool Status
   */
  function increaseAllowance(address spender, uint256 addedValue) external virtual returns (bool) {
    _approve(_msgSender(), spender, _allowances[_msgSender()][spender] + addedValue);
    return true;
  }

  /**
   * @dev Function to decrease allowance
   * @param spender Address
   * @param subtractedValue Amount to decrease
   * @return bool Status
   */
  function decreaseAllowance(
    address spender,
    uint256 subtractedValue
  ) external virtual returns (bool) {
    require(
      _allowances[_msgSender()][spender] - subtractedValue >= 0,
      'ERC20: Decreased allowance below zero'
    );
    _approve(_msgSender(), spender, _allowances[_msgSender()][spender] - subtractedValue);
    return true;
  }

  /**
   * @dev Internal function to give allowance
   * @param owner Address
   * @param spender Address
   * @param amount Amount
   */
  function _approve(address owner, address spender, uint256 amount) internal {
    require(owner != address(0), 'ERC20: Approve from the zero address');
    require(spender != address(0), 'ERC20: Approve to the zero address');

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }

  /**
   * @dev To whitelist addresses from fee uniswap buy and sell
   * @param account Address
   * @param value Bool
   */
  function setExcludedFromFee(address account, bool value) external onlyOwner {
    _isExcludedFromFee[account] = value;
    emit ExcludeFromFees(account, value);
  }

  /**
   * @dev To check if the address is whitelisted
   * @param account Address
   */
  function isExcludedFromFee(address account) external view returns (bool) {
    return _isExcludedFromFee[account];
  }

  /**
   * @dev To enable uniswap buy and sell
   * @param _enabled Bool
   */
  function setSwapEnabled(bool _enabled) external onlyOwner {
    swapEnabled = _enabled;
  }

  /**
   * @dev To enable fee on uniswap buy and sell
   * @param _enabled Bool
   */
  function setFeeEnabled(bool _enabled) external onlyOwner {
    takeFeeEnabled = _enabled;
  }

  /**
   * @dev To update fee transfering token amount
   * @param _swaptokens Amount
   */
  function updateSwapTokensAt(uint256 _swaptokens) external onlyOwner {
    swapTokensAtAmount = _swaptokens;
  }

  /**
   * @dev To update maximum wallet balance
   * @param _walletMax Amount
   */
  function updateWalletMax(uint256 _walletMax) external onlyOwner {
    maxWalletBalance = _walletMax;
  }

  /**
   * @dev To update maximum transaction limit
   * @param _txMax Amount
   */
  function updateTransactionMax(uint256 _txMax) external onlyOwner {
    maxTxAmount = _txMax;
  }

  /**
   * @dev To update fee percentages. Must be given as percentage * 100
   * @param _marketingFee Marketing fee
   * @param _adminFundFee Admin Fund Fee
   * @param _lpFee Liquidity Fee
   */
  function updateFees(
    uint256 _marketingFee,
    uint256 _adminFundFee,
    uint256 _lpFee
  ) external onlyOwner {
    totalFee = _marketingFee + _adminFundFee + _lpFee;
    require(
      totalFee <= 10000,
      'MyToken: Total Fees cannot be greater than 10000 (100%)(1500 = 1.5%)'
    );

    marketingFee = _marketingFee;
    adminFee = _adminFundFee;
    lpFee = _lpFee;
  }

  /**
   * @dev To update marketing fee wallet address
   * @param newWallet Address
   */
  function updateMarketingWallet(address newWallet) external onlyOwner zeroAddressCheck(newWallet) {
    require(newWallet != marketingWallet, 'MyToken: The Marketing wallet is already this address');
    emit MarketingWalletUpdated(newWallet, marketingWallet);

    marketingWallet = newWallet;
  }

  /**
   * @dev To update admin fund fee wallet address
   * @param newWallet Address
   */
  function updateAdminFundWallet(address newWallet) external onlyOwner zeroAddressCheck(newWallet) {
    require(newWallet != adminFundWallet, 'MyToken: The Admin Fund wallet is already this address');
    emit adminFundWalletUpdated(newWallet, adminFundWallet);

    adminFundWallet = newWallet;
  }

  /**
   * @dev To update splitting amount of total fee. Must be given as percentage * 100
   * @param marketingPortion Marketing fee
   * @param adminProtion Admin Fund Fee
   * @param lpPortion Liquidity Fee
   */
  function updatePortionsOfSwap(
    uint256 marketingPortion,
    uint256 adminProtion,
    uint256 lpPortion
  ) external onlyOwner {
    uint256 totalPortion = marketingPortion + adminProtion + lpPortion;
    require(totalPortion == 10000, 'MyToken: Total must be equal to 10000 (100%)(1500 = 1.5%)');

    marketingPortionOfSwap = marketingPortion;
    adminPortionOfSwap = adminProtion;
    lpPortionOfSwap = lpPortion;
  }

  /**
   * @dev To enable and disable token transactions
   * @param tradingStatus Bool
   */
  function updateTradingIsEnabled(bool tradingStatus) external onlyOwner {
    tradingIsEnabled = tradingStatus;
  }

  /**
   * @dev To update uniswap router address
   * @param newAddress Router address
   */
  function updateRouterAddress(address newAddress) external onlyOwner zeroAddressCheck(newAddress) {
    require(newAddress != address(router), 'MyToken: The router already has that address');
    emit UpdateUniswapRouter(newAddress, address(router));

    router = IUniswapV2Router02(newAddress);
  }

  /**
   * @dev Internal function for token transfer. Deducting and transferring of fee will also triggered from here.
   * @param sender Address
   * @param recipient Address
   * @param amount Amount to transfer
   */
  function _transfer(address sender, address recipient, uint256 amount) private {
    require(sender != address(0), 'ERC20: Transfer from the zero address');
    require(recipient != address(0), 'ERC20: Transfer to the zero address');
    require(amount > 0, 'ERC20: Transfer amount must be greater than zero');
    require(balanceOf(sender) >= amount, 'ERC20: Transfer amount exceeds balance');
    require(tradingIsEnabled, 'MyToken: This account cannot send tokens until trading is enabled');

    ///router -> pair is adding liquidity which shouldn't have max
    if (sender != address(router)) {
      require(amount <= maxTxAmount, 'MyToken: Transfer amount exceeds the Max Transaction Amount');
    }

    if (
      maxWalletBalance > 0 &&
      !_isExcludedFromFee[recipient] &&
      !_isExcludedFromFee[sender] &&
      recipient != address(pair)
    ) {
      uint256 recipientBalance = balanceOf(recipient);
      require(
        recipientBalance + amount <= maxWalletBalance,
        'MyToken: New balance would exceed the maxWalletBalance'
      );
    }

    /// Indicates whether or not fee should be deducted from the transfer
    bool _isTakeFee = takeFeeEnabled;

    /// if any account belongs to _isExcludedFromFee then remove the fee
    if (_isExcludedFromFee[sender] || _isExcludedFromFee[recipient]) {
      _isTakeFee = false;
    }

    ///To check exisiting fee collected and transfer it to accounts
    _beforeTokenTransfer(sender);

    ///To do the transaction and fee deduction
    _transferTokens(sender, recipient, amount, _isTakeFee);
  }

  /**
   * @dev Private function to transfer collected fee.
   * @param sender Address
   */
  function _beforeTokenTransfer(address sender) private {
    ///Fee collected is held by contract itself
    uint256 contractTokenBalance = balanceOf(address(this));
    bool canSwap = contractTokenBalance > swapTokensAtAmount;
    bool swapStatus = !swapping && canSwap && swapEnabled;

    /**
     * Transfering fee on token buy will create issue with uniswap protocols.
     * Confirming transaction is not uniswap buy
     */
    bool sellOnly = sender != pair && sender != address(router);

    if (swapStatus && sellOnly) {
      /**
       * During swapBack, _transaction function will be called again.
       * To complete this transaction without revert from reentrant guard, blocking the reentrancy manually
       */
      swapping = true;

      ///Swapping fee collected to ETH and transfering to specified accounts
      swapBack();

      swapping = false;
    }
  }

  /**
   * @dev Private function to swap part of the contract token balance to ETH and transfer to accounts.
   */
  function swapBack() private nonReentrant {
    /**
     * amountToSwap will be
     * marketing fee + crub fund fee + half of liquidity portion
     * other half of liquidity will be added to pool along with swapped ETH to keep the pool stable
     */
    uint256 splitLiquidityPortion = lpPortionOfSwap / 2;
    uint256 amountToLiquify = (balanceOf(address(this)) * splitLiquidityPortion) / FEES_DIVISOR;
    uint256 amountToSwap = balanceOf(address(this)) - amountToLiquify;

    uint256 balanceBefore = address(this).balance;

    ///Uniswap swap function to swap token -> ETH
    swapTokensForETH(amountToSwap);

    uint256 amountETH = address(this).balance - balanceBefore;

    ///Calculating fee in ETH
    uint256 amountETHMarketing = (amountETH * marketingPortionOfSwap) / FEES_DIVISOR;
    uint256 amountETHAdminFund = (amountETH * adminPortionOfSwap) / FEES_DIVISOR;
    uint256 amountETHLiquidity = (amountETH * splitLiquidityPortion) / FEES_DIVISOR;

    //Sending fee in ETH to addresses
    transferEthToAddress(payable(marketingWallet), amountETHMarketing);
    transferEthToAddress(payable(adminFundWallet), amountETHAdminFund);

    // Adding liquidity
    _addLiquidity(amountToLiquify, amountETHLiquidity);
  }

  /**
   * @dev Private function to add liquidity to uniswap pool.
   * @param tokenAmount Token amount
   * @param ethAmount ETH amount
   */
  function _addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
    /// Approve token transfer to cover all possible scenarios
    _approve(address(this), address(router), tokenAmount);

    /// Add the liquidity using uniswap function
    (uint256 tokenAmountSent, uint256 ethAmountSent, uint256 liquidity) = router.addLiquidityETH{
      value: ethAmount
    }(address(this), tokenAmount, 0, 0, owner(), block.timestamp);

    emit LiquidityAdded(tokenAmountSent, ethAmountSent, liquidity);
  }

  /**
   * @dev Private function to swap tokens for ETH.
   * @param tokenAmount Token amount
   */
  function swapTokensForETH(uint256 tokenAmount) private {
    /// Generate the uniswap pair path of token -> weth
    address[] memory path = new address[](2);
    path[0] = address(this);
    path[1] = router.WETH();

    _approve(address(this), address(router), tokenAmount);

    /// Make the swap using uniswap function
    router.swapExactTokensForETHSupportingFeeOnTransferTokens(
      tokenAmount,
      0, /// accept any amount of ETH
      path,
      address(this),
      block.timestamp
    );

    emit SwapTokensForETH(tokenAmount, path);
  }

  /**
   * @dev Private function to do token transfer and deduct fee.
   * @param sender Address
   * @param recipient Address
   * @param amount Token amount
   * @param takeFee Bool
   */
  function _transferTokens(
    address sender,
    address recipient,
    uint256 amount,
    bool takeFee
  ) private {
    uint256 sumOfFees = totalFee;

    /// Transfer between wallets
    if (sender != pair && recipient != pair) {
      sumOfFees = 0;
    }

    if (!takeFee) {
      sumOfFees = 0;
    }

    /// Update balances
    _balances[sender] = _balances[sender] - amount;
    if (sumOfFees > 0) {
      /// Deduct fee
      _takeFee(sender, recipient, amount, sumOfFees);
    } else {
      _balances[recipient] = _balances[recipient] + amount;
      emit Transfer(sender, recipient, amount);
    }
  }

  /**
   * @dev Internal function to calculate fee and transfer amounts.
   * @param tAmount Amount
   * @param feesSum Total Fee
   * @return tTransferAmount Amount to transfer
   * @return tTotalFees Total fee to deduct
   */
  function _getValues(uint256 tAmount, uint256 feesSum) internal pure returns (uint256, uint256) {
    uint256 tTotalFees = (tAmount * feesSum) / FEES_DIVISOR;
    uint256 tTransferAmount = tAmount - tTotalFees;

    return (tTransferAmount, tTotalFees);
  }

  /**
   * @dev Private function to do transaction and deduct fee.
   * @param sender Address
   * @param recipient Address
   * @param amount Token amount
   * @param sumOfFees Total fee
   */
  function _takeFee(address sender, address recipient, uint256 amount, uint256 sumOfFees) private {
    (uint256 tTransferAmount, uint256 tTotalFees) = _getValues(amount, sumOfFees);
    _balances[recipient] = _balances[recipient] + tTransferAmount;
    _balances[address(this)] = _balances[address(this)] + tTotalFees;
    collectedFeeTotal = collectedFeeTotal + tTotalFees;
    emit Transfer(sender, recipient, tTransferAmount);
  }

  /**
   * @dev Private function to transfer ETH.
   * @param recipient Address
   * @param amount Token amount
   */
  function transferEthToAddress(address payable recipient, uint256 amount) private {
    require(recipient != address(0), 'MyToken: Cannot transfer the ETH to a zero address');
    (bool sendStatus, ) = payable(recipient).call{ value: amount }('');
    require(sendStatus, 'MyToken: Failed to transfer ETH');
  }

  /**
   * @dev External function to withdraw leftover tokens in terms of ETH.
   * @param recipient Address
   * @param amount Token amount
   */
  function swapTokensAndWithdrawInETH(
    address payable recipient,
    uint256 amount
  ) external onlyOwner {
    require(recipient != address(0), 'MyToken: Cannot withdraw to a zero address');
    require(balanceOf(address(this)) >= amount, 'MyToken: Swap amount exceeds balance');
    uint256 balanceBefore = address(this).balance;
    swapTokensForETH(amount);
    uint256 amountETH = address(this).balance - balanceBefore;
    require(amountETH > 0, 'MyToken: Zero ETH to transfer');
    transferEthToAddress(recipient, amountETH);
  }

  /**
   * @dev External function to withdraw leftover ETH.
   * @param recipient Address
   */
  function withdrawETH(address payable recipient) external onlyOwner {
    require(recipient != address(0), 'MyToken: Cannot withdraw to a zero address');
    (bool sendStatus, ) = payable(recipient).call{ value: address(this).balance }('');
    require(sendStatus, 'Failed to transfer ETH');
  }
}
