# Token Contract

## Introduction

This Repository is a truffle project which contains Token Contract (ERC20)

## Contracts

### Token

ERC20 Token contract with custom transfer function logic.
A fee will be taken from every uniswap transactions of this token.
This fee will be sent to different accounts when it reaches a specific limit.

## Tools and Framework

### Git

Git is software for tracking changes in any set of files, usually used for coordinating work among programmers collaboratively developing source code during software development. Its goals include speed, data integrity, and support for distributed, non-linear workflows.

### Truffle

Truffle is a world-class development environment, testing framework and asset pipeline for blockchains using the Ethereum Virtual Machine (EVM), aiming to make life as a developer easier. We use truffle in this project to compile and deploy the Token contract in specified network

## Prerequisite

### Install Git

Run below commands

```bash
    sudo apt install git-all
```

### Install NodeJS

Run below commands

```bash
    curl -fsSL https://deb.nodesource.com/setup_lts.x |sudo -E bash -
    sudo apt-get install -y nodejs
```

### Install truffle

Run below commands

```bash
    sudo npm install truffle -g
```

## Versions used

- Ubuntu - 22.04.1 LTS
- Git - 2.34.1
- NodeJs - 16.14.2
- Node Package Manager(NPM) - 8.5.0
- Truffle - 5.5.5
- Solidity - 0.8.15

## Initial Setup

1. Clone Repo from https://github.com/prasanthdotv/erc20-with-uniswap-v2
2. Open Terminal in the project folder and run `npm install` to install the dependencies.

## Contract Testing (optional)

1. Open Terminal in the project folder.
2. Run `npm run test` to run the Contract test cases

## Configurations

### Contract configurations

The contract configuration can be done in the contract itself. Some of the parameters are to be passed on deployment.

### Environment variables

In order to compile and deploy the contract, there are certain values to be set in environment variable.

Before starting this section we will understand about .openzeppelin folder. This folder contain set of json files with network names as file name with contents being the contract addresses deployed under that network. This file is one of the key file to track contract deployment and perform change/upgrade.

### Method 1: using command line

1. Set mnemonic

   Run below command to set mnemonic environment variable.

   ```bash
   export MNEMONIC=<Mnemonic>
   ```

2. Set Infura Key

   Run below command to set Infura Project Key environment variable.

   ```bash
   export INFURA_KEY=<YourInfuraProjectKey>
   ```

3. Set Etherscan API Key

   Run below command to set Etherscan API Key environment variable.

   ```bash
   export ETHERSCAN_KEY=<YourEtherscanApiKey>
   ```

4. Set Token Name

   Run below command to set ERC20 Token Name.

   ```bash
   export NAME=<MyToken>
   ```

5. Set Token Symbol

   Run below command to set ERC20 Token Symbol.

   ```bash
   export SYMBOL=<MyTokenSymbol>
   ```

6. Set Decimals

   Run below command to set ERC20 Token Decimals (Max 18).

   ```bash
   export DECIMALS=<decimals>
   ```

7. Set Total Supply

   Run below command to set Total token supply.

   ```bash
   export TOTAL_SUPPLY=<TotalSupply>
   ```

8. Set Marketing Fund Wallet

   Run below command to set Marketing Fund Wallet. A part of debited fee will be transferred to this wallet in terms of Ethereum.

   ```bash
   export MARKETING_FUND_WALLET=<WalletAddress>
   ```

9. Set ADMIN Fund Wallet

   Run below command to set Admin Fund Wallet. A part of debited fee will be transferred to this wallet in terms of Ethereum.

   ```bash
   export ADMIN_FUND_WALLET=<WalletAddress>
   ```

### Method 2: using .env file

1. Make a copy of `.env.sample` and rename it as `.env`
2. Assign the appropriate values to each variable. You can refer Method 1 to understand what each variable means.

## Deployment

### Ropsten

1. Make sure contract configurations are correct
2. Set the environment variables as required
3. Deploy contract with below command
   ```bash
   truffle migrate --network ropsten
   ```
4. Deployed contract address will be logged in console

### Ethereum Mainnet

1. Make sure contract contract configurations are correct
2. Set the environment variables as required
3. Deploy contract with below command
   ```bash
   truffle migrate --network mainnet
   ```
4. Deployed contract address will be logged in console
