pragma solidity ^0.4.4;

import "./StoriqaCoin.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract ICO is Ownable {
  // STQ per ETH
  uint public constant TOKEN_PRICE = 100;
  // ICO start date
  uint public start;

  event StartICO();
  event FinishICO(uint256 teamTokens, uint256 totalTokens);

  StoriqaCoin public stq;

  // ICO state
  enum IcoState { Init, Running, Finished }
  IcoState public icoState = IcoState.Init;

  function ICO() {
    stq = new StoriqaCoin(this);
    /*emission = new Emission(stq);*/
    // 18/09/2017
    start = 1505692800;
  }

  function isFinished() public returns (bool) {
    return icoState == IcoState.Finished;
  }

  // fallback function: by default buy stq tokens
  function() external payable {
    buyFor(msg.sender);
  }

  // buy tokens
  // check ICO state is Running
  // check is ether is present
  // calculate stq tokens
  // check to overflow
  // by tokens
  function buyFor(address to) public payable {
    require(icoState == IcoState.Running);
    require(msg.value > 0);

    uint256 totalTokens = msg.value * TOKEN_PRICE;

    require((stq.balanceOf(to) + totalTokens) >= stq.balanceOf(to));

    buy(to, totalTokens);
  }

  // internal function to buy token
  // calculate bonus
  function buy(address to, uint256 stqValue) internal {
    uint256 total = produceBonus(stqValue);

    stq.mint(to, total);
  }

  // produce bonus
  function produceBonus(uint value) returns (uint) {
    uint multiplier = getICOMultiplier();

    return uint(value * multiplier) / 100;
  }

  // produce ICO multiplier for bonus calculation
  function getICOMultiplier() returns (uint) {
    uint multiplier = 100;

    if (now <= start + (1 days - 1 seconds)) {
      return multiplier = 125;
    }
    if (now <= start + (3 days - 1 seconds)) {
      return multiplier = 120;
    }
    if (now <= start + (6 days - 1 seconds)) {
      return multiplier = 115;
    }
    if (now <= start + (10 days - 1 seconds)) {
      return multiplier = 110;
    }
    if (now <= start + (14 days - 1 seconds)) {
      return multiplier = 105;
    }

    return multiplier;
  }

  // starting ICO
  function startIco() external onlyOwner {
    require(icoState == IcoState.Init);
    icoState = IcoState.Running;
    StartICO();
  }

  // finishing ICO
  // calculate owner tokens (as part of 80% of all emitted tokens)
  // send this tokens to owner
  // set ICO state to finished
  function finishIco() external onlyOwner {
    require(icoState == IcoState.Running);

    /*uint256 mintedTokens = stq.totalSupply();*/
    /*uint256 teamTokens = mintedTokens * 4;*/

    uint256 teamTokens = stq.totalSupply() * 4;
    buy(msg.sender, teamTokens);

    uint256 totalMintedTokens = stq.totalSupply();

    icoState = IcoState.Finished;
    FinishICO(teamTokens, totalMintedTokens);
  }
}
