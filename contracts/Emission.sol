pragma solidity ^0.4.4;

import "./StoriqaCoin.sol";
import "./ICO.sol";

contract Emission is Ownable {
  // stage => address => is bonus emitted
  mapping (uint => mapping (address => bool)) bonusEmitted;
  // stage => users / stores / total amout of tokens on stage / bonus tokens
  mapping (uint => uint256[4]) stageIndicators;
  // current stage
  uint emissionStage;

  event UpdateICOStage(uint stage, uint users, uint stores, uint256 total, uint256 bonus);
  event FetchBonus(address user, uint256 quantity);

  StoriqaCoin public stq;
  ICO public ico;

  function Emission(address _stq, address _ico) {
    stq = StoriqaCoin(_stq);
    ico = ICO(_ico);
    emissionStage = 0;
  }

  // check is ico finished
  modifier ICOFinished() {
    /*ico.isFinished();*/
    require(ico.isFinished());
    _;
  }

  // check caller has stq tokens
  modifier STQOwner() {
    require(stq.balanceOf(msg.sender) > 0);
    _;
  }

  // check is emission in progress: emission in progress if stage > 0
  modifier emissionInProcess() {
    require(emissionStage > 0);
    _;
  }

  // migrate to new emission stage
  // must be called only by owner and when ICO was finished
  // increment current stage
  // calculate available bonus on this stage
  // save parameters:
  // stage => user quantity, stores quantity, total tokens on stage finish, available bonus
  // return true if success
  function updateICOStage(uint users, uint stores) external onlyOwner ICOFinished returns (bool) {
    emissionStage = emissionStage + 1;
    uint256 stageBonusTokens = users + stores * 100;
    stageIndicators[emissionStage] = [users, stores, stq.totalSupply(), stageBonusTokens];

    UpdateICOStage(emissionStage, users, stores, stq.totalSupply(), stageBonusTokens);

    return true;
  }

  // fetch bonus by user for stage
  // must be called by user if: emission is started, provided stage is present, ICO was finished,
  // callee is token owner and bonus doesn't already produced for user
  // calculate bonus for user and mint it
  // set emitted flag for user, that prevent multiply bonus producing
  //
  //
  // здесь уязвимость - люди могут запрашивать бонус, потом переводить токены на новый адрес и снова запрашивать бонус
  // ??? сделать сразу предварительный расчет бонусов и хранить их до востребования
  //
  // запретить продажу токенов если сейчас происходит начисление бонусов?
  //
  function fetchBonus(uint stage) external emissionInProcess ICOFinished STQOwner returns (bool) {
    require(stage <= emissionStage);
    require(!bonusEmitted[stage][msg.sender]);

    uint[4] indicators = stageIndicators[stage];
    uint256 users = indicators[0];
    uint256 stores = indicators[1];
    uint256 stageTokens = indicators[2];
    uint256 bonusTokens = indicators[3];
    uint256 userTokens = stq.balanceOf(msg.sender);

    uint256 userBonusTokens = (uint256(users + stores * 100) * userTokens) / stageTokens;

    stq.mint(msg.sender, userBonusTokens);
    bonusEmitted[stage][msg.sender] = true;

    FetchBonus(msg.sender, userBonusTokens);

    return true;
  }
}
