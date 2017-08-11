pragma solidity ^0.4.4;

// для окончания создания токенов - нужно вызвать finishMinting()
//

import 'zeppelin-solidity/contracts/token/MintableToken.sol';

contract StoriqaCoin is MintableToken {
  string public name = 'Storiqa Token';
  string public symbol = 'STQ';
  uint public decimals = 18;

  address public ico;

  function StoriqaCoin(address _ico) {
    totalSupply = 0;
    // ????? нужно ли? нужно только для того чтоб проверить откуда пришел запрос - от ico
    ico = _ico;
  }

  /*function mint(address _holder, uint _value) external {
    require(msg.sender == ico);
    require(_value > 0);

  }*/

  // здесь смотрим сколько послано эфира и
  // вычисляем сколько нужно присвоить токенов адресу
  // проверить моежт уже есть хорошая реализация в отнаследованном коде
  /*function transfer(address _to, uint256 _value) {

  }*/
}
