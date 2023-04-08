const deploy = require('./deploy');
const uniswapService = require('./uniswapService');

module.exports = {
  deploy,
  Uniswap: uniswapService,
};
