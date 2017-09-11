pragma solidity 0.4.15;

import '../STQCrowdsale.sol';


/// @title Test helper for STQCrowdsale, DONT use it in production!
contract STQCrowdsaleTestHelper is STQCrowdsale {

    function STQCrowdsaleTestHelper(address[] _owners, address _token, address _funds)
        STQCrowdsale(_owners, _token, _funds)
    {
    }


    function getCurrentTime() internal constant returns (uint) {
        return m_time;
    }

    function setTime(uint time) external onlyowner {
        m_time = time;
    }


    function getMinFunds() internal constant returns (uint) {
        return 100 finney;
    }

    function getMaximumFunds() internal constant returns (uint) {
        return 400 finney;
    }


    uint m_time;
}
