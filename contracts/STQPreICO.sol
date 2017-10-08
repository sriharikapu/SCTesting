pragma solidity 0.4.15;

import './STQToken.sol';
import './crowdsale/InvestmentAnalytics.sol';
import 'zeppelin-solidity/contracts/ReentrancyGuard.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';


/// @title Storiqa pre-ICO contract
contract STQPreICO is Ownable, ReentrancyGuard, InvestmentAnalytics {
    using SafeMath for uint256;

    event FundTransfer(address backer, uint amount, bool isContribution);

    function STQPreICO(address token, address funds) {
        require(address(0) != address(token) && address(0) != address(funds));

        m_token = STQToken(token);
        m_funds = funds;
    }


    // PUBLIC interface: payments

    // fallback function as a shortcut
    function() payable {
        require(0 == msg.data.length);
        buy();  // only internal call here!
    }

    /// @notice ICO participation
    function buy() public payable {     // dont mark as external!
        iaOnInvested(msg.sender, msg.value, false);
    }


    // PUBLIC interface: maintenance

    function createMorePaymentChannels(uint limit) external onlyOwner returns (uint) {
        return createMorePaymentChannelsInternal(limit);
    }

    /// @notice Tests ownership of the current caller.
    /// @return true if it's an owner
    // It's advisable to call it by new owner to make sure that the same erroneous address is not copy-pasted to
    // addOwner/changeOwner and to isOwner.
    function amIOwner() external constant onlyOwner returns (bool) {
        return true;
    }


    // INTERNAL

    /// @dev payment callback
    function iaOnInvested(address investor, uint payment, bool usingPaymentChannel)
        internal
        nonReentrant
    {
        require(payment >= c_MinInvestment);
        require(getCurrentTime() >= c_startTime && getCurrentTime() < c_endTime || msg.sender == owner);

        uint startingInvariant = this.balance.add(m_funds.balance);

        // return or update payment if needed
        uint paymentAllowed = getMaximumFunds().sub(m_totalInvested);
        if (0 == paymentAllowed) {
            investor.transfer(payment);
            return;
        }
        uint change;
        if (paymentAllowed < payment) {
            change = payment.sub(paymentAllowed);
            payment = paymentAllowed;
        }

        // calculate rate
        uint bonusPercent = c_preICOBonusPercent;
        bonusPercent += getLargePaymentBonus(payment);
        if (usingPaymentChannel)
            bonusPercent += c_paymentChannelBonusPercent;

        uint rate = c_STQperETH.mul(100 + bonusPercent).div(100);

        // issue tokens
        uint stq = payment.mul(rate);
        m_token.mint(investor, stq);

        // record payment
        m_funds.transfer(payment);
        m_totalInvested = m_totalInvested.add(payment);
        assert(m_totalInvested <= getMaximumFunds());
        FundTransfer(investor, payment, true);

        if (change > 0)
            investor.transfer(change);

        assert(startingInvariant == this.balance.add(m_funds.balance).add(change));
    }

    function getLargePaymentBonus(uint payment) private constant returns (uint) {
        if (payment > 1000 ether) return 10;
        if (payment > 800 ether) return 8;
        if (payment > 500 ether) return 5;
        if (payment > 200 ether) return 2;
        return 0;
    }

    /// @dev to be overridden in tests
    function getCurrentTime() internal constant returns (uint) {
        return now;
    }

    /// @dev to be overridden in tests
    function getMaximumFunds() internal constant returns (uint) {
        return c_MaximumFunds;
    }


    // FIELDS

    /// @notice start time of the pre-ICO
    uint public constant c_startTime = 1507766400;

    /// @notice end time of the pre-ICO
    uint public constant c_endTime = c_startTime + (1 days);

    /// @notice minimum investment
    uint public constant c_MinInvestment = 10 finney;

    /// @notice maximum investments to be accepted during pre-ICO
    uint public constant c_MaximumFunds = 8000 ether;


    /// @notice starting exchange rate of STQ
    uint public constant c_STQperETH = 100000;

    /// @notice pre-ICO bonus
    uint public constant c_preICOBonusPercent = 40;

    /// @notice authorised payment bonus
    uint public constant c_paymentChannelBonusPercent = 2;


    /// @dev total investments amount
    uint public m_totalInvested;

    /// @dev contract responsible for token accounting
    STQToken public m_token;

    /// @dev address responsible for investments accounting
    address public m_funds;
}
