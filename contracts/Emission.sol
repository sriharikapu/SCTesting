pragma solidity ^0.4.4;

import "./StoricaCoin.sol";

contract Emission is Ownable {
  // stage => address => is bunus emitted
  mapping (uint => mapping (address => bool)) bonusEmitted;
  // stage => users / stores / total amout of tokens on stage / bonus tokens
  mapping (uint => uint[4]) stageIndicators;
  // current stage
  uint emissionStage;

  event UpdateICOStage(uint stage, uint, users, uint stores, uint256 total, uint256 bonus);
  event FetchBonus(address user, uint256 quantity);

  StoricaCoin public stq;
  ICO public ico;

  function Emission(address _stq, address _ico) {
    stq = _stq;
    ico = _ico;
    emissionStage = 0;
  }

  // check is ico finished
  modifier ICOFinished() {
    require(ico.icoState == ico.IcoState.Finished);
    _;
  }

  // check callee has stq tokens
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
  // calculate available bonus on thes stage
  // save parameters:
  // stage => user quantity, stores quantity, total tokens on stage finish, available bonus
  // return true if success
  function updateICOStage(uint users, uint stores) external onlyOwner ICOFinished returns (bool) {
    emissionStage = emissionStage + 1;
    uint256 stageBonusTokens = users + stores * 100;
    stageIndicators[emissionStage] = [users, stores, stq.totalSupply, stageBonusTokens];

    UpdateICOStage(emissionStage, users, stores, stq.totalSupply, stageBonusTokens);

    return true;
  }

  // fetch bonus by user for stage
  // must be called by user if: emission is started, provided stage is present, ICO was finished,
  // callee is token owner and bonus doesn't already produced for user
  // calculate bonus for user and mint it
  // set emitted flag for user, that prevent multiply bonus producing
  function fetchBonus(uint stage) external emissionInProcess ICOFinished STQOwner returns (uint) {
    require(stage <= emissionStage);
    require(!bonusEmitted[stage][msg.sender]);

    uint[3] indicators = stageIndicators[stage];
    uint256 users = uint256(indicators[0]);
    uint256 stores = uint256(indicators[1]);
    uint256 stageTokens = indicators[2];
    uint256 bonusTokens = indicators[3];
    uint256 userTokens = stq.balanceOf(msg.sender);

    uint256 bonusTokens = (uint256(users + stores * 100) * userTokens) / stageTokens;

    stq.mint(msg.sender, bonusTokens);

    FetchBonus(msg.sender, bonusTokens);

    bonusEmitted[stage][msg.sender] = true;
    return true;
  }
}
