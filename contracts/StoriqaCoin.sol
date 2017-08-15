pragma solidity ^0.4.4;

// для окончания создания токенов - нужно вызвать finishMinting()
//

import 'zeppelin-solidity/contracts/token/MintableToken.sol';

contract StoriqaCoin is MintableToken {
  string public name = 'Storiqa Token';
  string public symbol = 'STQ';
  uint public decimals = 18;

  /*address public ico;*/

  function StoriqaCoin() {
    totalSupply = 0;
    // ????? нужно ли? нужно только для того чтоб проверить откуда пришел запрос - от ico
    /*ico = _ico;*/
  }
}
