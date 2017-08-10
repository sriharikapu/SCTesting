pragma solidity ^0.4.4;

import "./StoricaCoin.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract ICO is Ownable {
  // STQ per ETH
  uint public constant TOKEN_PRICE = 100;
  // ICO start date
  uint public start;

  event StartICO();
  event FinishICO(uint teamTokens, uint totalTokens);

  StoricaCoin public stq;

  // ICO state
  enum IcoState { Init, Running, Finished }
  IcoState icoState = IcoState.Init;

  function ICO() {
    stq = new STQ(this);
    emission = new Emission(stq);
    // 18/09/2017
    start = 1505692800;
  }

  // fallback function: by default buy stq tokens
  function() external payable {
    buyFor(msg.sender);
  }

  function buyFor(address _to) public payable {
    require(icoState == IcoState.Running);
    require(msg.value > 0); // проверить на переполнение и может быт есть гуард где то уже

    buy(_to, msg.value * TOKEN_PRICE);
  }

  function buy(address _to, uint _stqValue) internal {
    uint _total = produceBonus(_stqValue);

    // переписать метод - сделать проверку что прислали эфир
    // и ico еще не закончено и можно майнить - MintableToken
    stq.mint(_to, _total);
  }

  function produceBonus(uint _value) {
    uint multiplier = getICOMultiplier();

    return uint(_value * multiplier) / 100;
  }

  // здесь смотрим на дату и в зависимости от нее возвращаем мультипликатор
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

  function startIco() external onlyOwner {
    require(icoState == IcoState.Init);
    icoState = IcoState.Running;
    StartICO();
  }

  function finishIco() external onlyOwner {
    require(icoState == IcoState.Running);

    // здесь нужно мультиплицировать токены
    // создать токены команды - 80%
    // и начислить овнеру
    // потом получить общее количество токенов
    // вызвать событие и вернуть общее количестов токенов и токены команды

    uint256 teamTokens = stq.totalSupply * 4; // это 80% команды
    buy(msg.sender, teamTokens);
    uint256 totalMintedTokens = stq.totalSupply;

    icoState = IcoState.Finished;
    FinishIco(teamTokens, totalMintedTokens);
  }

  /*// Mint few tokens and transefer them to some address.
  function mint(address _holder, uint _value) external {
    require(msg.sender == ico);
    require(_value != 0);
    require(totalSupply + _value <= TOKEN_LIMIT);

    balances[_holder] += _value;
    totalSupply += _value;
    Transfer(0x0, _holder, _value);
  }

  // эта функция в токене
  function mint(address _to, uint256 _amount) onlyOwner canMint returns (bool) {
    totalSupply = totalSupply.add(_amount);
    balances[_to] = balances[_to].add(_amount);
    Mint(_to, _amount);
    return true;
  }*/
}
